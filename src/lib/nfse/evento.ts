import { SignedXml } from 'xml-crypto'
import type { CertMaterial } from './certificate'

export interface CancelamentoInput {
  ambiente: 'producao' | 'homologacao'
  chaveAcesso: string // chave de acesso da NFS-e a cancelar (50 dígitos)
  documentoAutor: string // CNPJ ou CPF de quem está pedindo o cancelamento, só números
  cMotivo: '1' | '2' | '9' // 1=Erro na Emissão, 2=Serviço não Prestado, 9=Outros
  xMotivo: string
}

function esc(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function soNumeros(value: string) {
  return value.replace(/\D/g, '')
}

/** Converte para o horário de Brasília (UTC-3, sem horário de verão) no formato exigido pelo evento. */
function formatarDataHoraUTC(data: Date) {
  const local = new Date(data.getTime() - 3 * 60 * 60 * 1000)
  return local.toISOString().replace(/\.\d{3}Z$/, '-03:00')
}

/**
 * Monta o identificador do pedido de registro de evento conforme TSIdPedRegEvt:
 * "PRE" + Chave de Acesso NFS-e (50) + Tipo do evento (3) + Número do Pedido de Registro do Evento (3).
 * "101" para o tipo do evento (grupo do e101101 - Cancelamento de NFS-e) é a leitura mais direta do
 * padrão "PRE[0-9]{56}" documentado no schema oficial (50+3+3=56) — confirmar contra o retorno real
 * da SEFIN Nacional na primeira tentativa e ajustar se for rejeitado por formato de Id inválido.
 */
function montarIdPedRegEvento(chaveAcesso: string, nPedRegEvento: string) {
  return `PRE${chaveAcesso}101${nPedRegEvento.padStart(3, '0')}`
}

/** Monta o XML do Pedido de Registro de Evento de Cancelamento (e101101), ainda sem assinatura. */
export function montarXmlPedRegEventoCancelamento(input: CancelamentoInput): { xml: string; id: string } {
  const nPedRegEvento = '001'
  const id = montarIdPedRegEvento(input.chaveAcesso, nPedRegEvento)
  const tpAmb = input.ambiente === 'producao' ? '1' : '2'
  const documento = soNumeros(input.documentoAutor)
  const tagAutor = documento.length === 11 ? `<CPFAutor>${documento}</CPFAutor>` : `<CNPJAutor>${documento}</CNPJAutor>`

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<pedRegEvento xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01">` +
      `<infPedReg Id="${id}">` +
        `<tpAmb>${tpAmb}</tpAmb>` +
        `<verAplic>1.0.0</verAplic>` +
        `<dhEvento>${formatarDataHoraUTC(new Date())}</dhEvento>` +
        tagAutor +
        `<chNFSe>${input.chaveAcesso}</chNFSe>` +
        `<e101101>` +
          `<xDesc>Cancelamento de NFS-e</xDesc>` +
          `<cMotivo>${input.cMotivo}</cMotivo>` +
          `<xMotivo>${esc(input.xMotivo)}</xMotivo>` +
        `</e101101>` +
      `</infPedReg>` +
    `</pedRegEvento>`

  return { xml, id }
}

/**
 * Assina o XML do Pedido de Registro de Evento (mesmo padrão de assinatura da DPS:
 * SHA-256 / RSA-SHA256 / C14N exclusivo, envelopada sobre infPedReg).
 */
export function assinarPedRegEvento(xml: string, id: string, cert: CertMaterial): string {
  const sig = new SignedXml({
    privateKey: cert.privateKeyPem,
    publicCert: cert.certificatePem,
    signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
    canonicalizationAlgorithm: 'http://www.w3.org/2001/10/xml-exc-c14n#',
  })

  sig.addReference({
    xpath: `//*[local-name(.)='infPedReg']`,
    digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
    transforms: [
      'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
      'http://www.w3.org/2001/10/xml-exc-c14n#',
    ],
    uri: `#${id}`,
  })

  sig.getKeyInfoContent = () => `<X509Data><X509Certificate>${cert.certificatePem.replace(/-----[^-]+-----|\n/g, '')}</X509Certificate></X509Data>`

  sig.computeSignature(xml, {
    location: { reference: `//*[local-name(.)='infPedReg']`, action: 'after' },
  })

  return sig.getSignedXml()
}
