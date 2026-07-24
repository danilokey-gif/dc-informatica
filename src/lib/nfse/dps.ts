import { SignedXml } from 'xml-crypto'
import type { CertMaterial } from './certificate'

export interface DpsPrestador {
  documento: string // CNPJ (14 dígitos) ou CPF (11 dígitos), só números
  inscricaoMunicipal?: string
  razaoSocial?: string
}

export interface DpsTomador {
  documento?: string
  nome: string
}

export interface DpsServico {
  codigoTributacaoNacional: string // 6 dígitos: item(2) + subitem(2) + desdobro nacional(2)
  descricao: string
  valor: number
}

export interface DpsInput {
  ambiente: 'producao' | 'homologacao'
  codigoMunicipio: string // IBGE, 7 dígitos
  serie: string
  numero: number
  dataCompetencia: Date
  prestador: DpsPrestador
  tomador?: DpsTomador
  servico: DpsServico
  aliquotaIss: number // percentual, ex: 5 para 5%
  regimeTributario: 'MEI' | 'SIMPLES' | 'NORMAL'
}

/** Mapeia o regime tributário do prestador para os códigos exigidos pelo grupo regTrib da DPS. */
function montarRegTrib(regime: DpsInput['regimeTributario']) {
  // opSimpNac: 1=Não optante pelo Simples Nacional, 2=MEI, 3=ME/EPP optante pelo Simples Nacional
  const opSimpNac = regime === 'MEI' ? '2' : regime === 'SIMPLES' ? '3' : '1'
  // regApTribSN (regime de apuração) só se aplica quando opSimpNac=3 (ME/EPP) — MEI e Não optante não usam esse campo.
  const regApTribSN = regime === 'SIMPLES' ? `<regApTribSN>1</regApTribSN>` : ''
  return `<opSimpNac>${opSimpNac}</opSimpNac>${regApTribSN}<regEspTrib>0</regEspTrib>`
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

function formatarDecimal(valor: number) {
  return valor.toFixed(2)
}

/** Converte para o horário de Brasília (UTC-3, sem horário de verão) no formato exigido pela DPS. */
function formatarDataHoraUTC(data: Date) {
  const local = new Date(data.getTime() - 3 * 60 * 60 * 1000)
  return local.toISOString().replace(/\.\d{3}Z$/, '-03:00')
}

function formatarData(data: Date) {
  const local = new Date(data.getTime() - 3 * 60 * 60 * 1000)
  return local.toISOString().slice(0, 10)
}

/**
 * Monta o identificador da DPS conforme TSIdDPS: "DPS" + município(7) + tipoInscricao(1) + inscricao(14) + série(5) + número(15).
 * Convenção tipoInscricao (1=CPF, 2=CNPJ) inferida por analogia com o padrão NF-e/CT-e —
 * confirmar contra o manual de regras de negócio do Sistema Nacional antes da emissão em produção.
 */
function montarIdDps(codigoMunicipio: string, documentoPrestador: string, serie: string, numero: number) {
  const doc = soNumeros(documentoPrestador)
  const tipoInscricao = doc.length === 11 ? '1' : '2'
  const inscricao = doc.padStart(14, '0')
  const serieFmt = serie.padStart(5, '0')
  const numeroFmt = String(numero).padStart(15, '0')
  return `DPS${codigoMunicipio}${tipoInscricao}${inscricao}${serieFmt}${numeroFmt}`
}

/** Monta o XML da DPS (Declaração de Prestação de Serviços) ainda sem assinatura. */
export function montarXmlDps(input: DpsInput): { xml: string; id: string } {
  const id = montarIdDps(input.codigoMunicipio, input.prestador.documento, input.serie, input.numero)
  const tpAmb = input.ambiente === 'producao' ? '1' : '2'
  const docPrestador = soNumeros(input.prestador.documento)
  const tagDocPrestador = docPrestador.length === 11
    ? `<CPF>${docPrestador}</CPF>`
    : `<CNPJ>${docPrestador}</CNPJ>`

  const tomadorXml = input.tomador ? (() => {
    const docTomador = input.tomador!.documento ? soNumeros(input.tomador!.documento!) : ''
    const tagDocTomador = docTomador
      ? (docTomador.length === 11 ? `<CPF>${docTomador}</CPF>` : `<CNPJ>${docTomador}</CNPJ>`)
      : `<cNaoNIF>0</cNaoNIF>`
    return `<toma>${tagDocTomador}<xNome>${esc(input.tomador!.nome)}</xNome></toma>`
  })() : ''

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<DPS xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01">` +
      `<infDPS Id="${id}">` +
        `<tpAmb>${tpAmb}</tpAmb>` +
        `<dhEmi>${formatarDataHoraUTC(new Date())}</dhEmi>` +
        `<verAplic>1.0.0</verAplic>` +
        `<serie>${esc(input.serie)}</serie>` +
        `<nDPS>${input.numero}</nDPS>` +
        `<dCompet>${formatarData(input.dataCompetencia)}</dCompet>` +
        `<tpEmit>1</tpEmit>` +
        `<cLocEmi>${input.codigoMunicipio}</cLocEmi>` +
        `<prest>` +
          tagDocPrestador +
          (input.prestador.inscricaoMunicipal ? `<IM>${esc(input.prestador.inscricaoMunicipal)}</IM>` : '') +
          // xNome do prestador não é informado: tpEmit=1 (emitente é o próprio prestador), o
          // sistema já identifica o nome pelo CNPJ e rejeita a DPS se vier repetido aqui.
          `<regTrib>${montarRegTrib(input.regimeTributario)}</regTrib>` +
        `</prest>` +
        tomadorXml +
        `<serv>` +
          `<locPrest><cLocPrestacao>${input.codigoMunicipio}</cLocPrestacao></locPrest>` +
          `<cServ>` +
            `<cTribNac>${input.servico.codigoTributacaoNacional}</cTribNac>` +
            `<xDescServ>${esc(input.servico.descricao)}</xDescServ>` +
          `</cServ>` +
        `</serv>` +
        `<valores>` +
          `<vServPrest><vServ>${formatarDecimal(input.servico.valor)}</vServ></vServPrest>` +
          `<trib>` +
            `<tribMun>` +
              `<tribISSQN>1</tribISSQN>` +
              `<tpRetISSQN>1</tpRetISSQN>` +
              // MEI não informa alíquota: o ISS é um valor fixo mensal (DAS-MEI), não calculado por nota.
              (input.regimeTributario === 'MEI' ? '' : `<pAliq>${formatarDecimal(input.aliquotaIss)}</pAliq>`) +
            `</tribMun>` +
            `<totTrib><indTotTrib>0</indTotTrib></totTrib>` +
          `</trib>` +
        `</valores>` +
      `</infDPS>` +
    `</DPS>`

  return { xml, id }
}

/**
 * Assina o XML da DPS (assinatura envelopada, padrão da família NF-e/CT-e).
 * Algoritmos (SHA-256 / RSA-SHA256 / C14N exclusivo) assumidos por serem os mais usados
 * atualmente nesta família de documentos fiscais — confirmar contra o manual de regras de
 * negócio do Sistema Nacional NFS-e antes da primeira emissão real, e ajustar se necessário.
 */
export function assinarDps(xml: string, id: string, cert: CertMaterial): string {
  const sig = new SignedXml({
    privateKey: cert.privateKeyPem,
    publicCert: cert.certificatePem,
    signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
    canonicalizationAlgorithm: 'http://www.w3.org/2001/10/xml-exc-c14n#',
  })

  sig.addReference({
    xpath: `//*[local-name(.)='infDPS']`,
    digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
    transforms: [
      'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
      'http://www.w3.org/2001/10/xml-exc-c14n#',
    ],
    uri: `#${id}`,
  })

  sig.getKeyInfoContent = () => `<X509Data><X509Certificate>${cert.certificatePem.replace(/-----[^-]+-----|\n/g, '')}</X509Certificate></X509Data>`

  sig.computeSignature(xml, {
    location: { reference: `//*[local-name(.)='infDPS']`, action: 'after' },
  })

  return sig.getSignedXml()
}
