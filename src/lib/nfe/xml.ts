import { SignedXml } from 'xml-crypto'
import type { CertMaterial } from '../nfse/certificate'

export interface NfeEndereco {
  logradouro: string
  numero: string
  bairro: string
  codigoMunicipio: string
  nomeMunicipio: string
  uf: string
  cep: string
}

export interface NfeEmitente {
  cnpj: string
  razaoSocial: string
  inscricaoEstadual: string
  crt: string // 1=Simples Nacional (inclui MEI), 2=Simples excesso sublimite, 3=Normal
  endereco: NfeEndereco
}

export interface NfeDestinatario {
  documento?: string
  nome: string
}

export interface NfeItem {
  codigo: string
  descricao: string
  ncm: string
  cfop: string
  unidade: string
  quantidade: number
  valorUnitario: number
}

export interface NfeInput {
  ambiente: 'producao' | 'homologacao'
  serie: string
  numero: number
  emitente: NfeEmitente
  destinatario?: NfeDestinatario
  itens: NfeItem[]
  formaPagamento: 'dinheiro' | 'pix' | 'cartao_credito' | 'cartao_debito' | 'outro'
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

/** Data/hora no fuso de Brasília (UTC-3, sem horário de verão) no formato exigido pela NF-e. */
function formatarDataHora(data: Date) {
  const local = new Date(data.getTime() - 3 * 60 * 60 * 1000)
  return local.toISOString().replace(/\.\d{3}Z$/, '-03:00')
}

/** Dígito verificador da chave de acesso (módulo 11, pesos 2-9 da direita pra esquerda). */
function calcularDV(chave43: string): string {
  let soma = 0
  let peso = 2
  for (let i = chave43.length - 1; i >= 0; i--) {
    soma += Number(chave43[i]) * peso
    peso = peso === 9 ? 2 : peso + 1
  }
  const resto = soma % 11
  const dv = resto < 2 ? 0 : 11 - resto
  return String(dv)
}

/** Código numérico aleatório (cNF) de 8 dígitos exigido pela chave de acesso. */
function gerarCodigoNumerico(): string {
  return String(Math.floor(Math.random() * 100000000)).padStart(8, '0')
}

const TP_PAGAMENTO: Record<NfeInput['formaPagamento'], string> = {
  dinheiro: '01',
  cartao_credito: '03',
  cartao_debito: '04',
  pix: '17',
  outro: '99',
}

/** Monta a chave de acesso de 44 dígitos: cUF+AAMM+CNPJ+mod+serie+nNF+tpEmis+cNF+cDV. */
function montarChaveAcesso(params: {
  cUF: string
  dataEmissao: Date
  cnpj: string
  serie: string
  numero: number
  cNF: string
}): string {
  const local = new Date(params.dataEmissao.getTime() - 3 * 60 * 60 * 1000)
  const aamm = `${String(local.getUTCFullYear()).slice(2)}${String(local.getUTCMonth() + 1).padStart(2, '0')}`
  const cnpj = soNumeros(params.cnpj).padStart(14, '0')
  const mod = '55'
  const serie = params.serie.padStart(3, '0')
  const numero = String(params.numero).padStart(9, '0')
  const tpEmis = '1'
  const chave43 = `${params.cUF}${aamm}${cnpj}${mod}${serie}${numero}${tpEmis}${params.cNF}`
  const dv = calcularDV(chave43)
  return `${chave43}${dv}`
}

const CUF_POR_UF: Record<string, string> = { SP: '35' }

/** Monta o XML da NF-e (modelo 55) ainda sem assinatura. */
export function montarXmlNfe(input: NfeInput): { xml: string; chaveAcesso: string } {
  const cUF = CUF_POR_UF[input.emitente.endereco.uf]
  if (!cUF) throw new Error(`UF não suportada: ${input.emitente.endereco.uf}`)

  const tpAmb = input.ambiente === 'producao' ? '1' : '2'
  const cNF = gerarCodigoNumerico()
  const dataEmissao = new Date()
  const chaveAcesso = montarChaveAcesso({
    cUF,
    dataEmissao,
    cnpj: input.emitente.cnpj,
    serie: input.serie,
    numero: input.numero,
    cNF,
  })
  const id = `NFe${chaveAcesso}`

  const vProdTotal = input.itens.reduce((acc, item) => acc + item.quantidade * item.valorUnitario, 0)

  const detXml = input.itens.map((item, index) => {
    const vProd = item.quantidade * item.valorUnitario
    return (
      `<det nItem="${index + 1}">` +
        `<prod>` +
          `<cProd>${esc(item.codigo)}</cProd>` +
          `<cEAN>SEM GTIN</cEAN>` +
          `<xProd>${esc(item.descricao)}</xProd>` +
          `<NCM>${item.ncm}</NCM>` +
          `<CFOP>${item.cfop}</CFOP>` +
          `<uCom>${esc(item.unidade)}</uCom>` +
          `<qCom>${item.quantidade.toFixed(4)}</qCom>` +
          `<vUnCom>${item.valorUnitario.toFixed(10)}</vUnCom>` +
          `<vProd>${formatarDecimal(vProd)}</vProd>` +
          `<cEANTrib>SEM GTIN</cEANTrib>` +
          `<uTrib>${esc(item.unidade)}</uTrib>` +
          `<qTrib>${item.quantidade.toFixed(4)}</qTrib>` +
          `<vUnTrib>${item.valorUnitario.toFixed(10)}</vUnTrib>` +
          `<indTot>1</indTot>` +
        `</prod>` +
        `<imposto>` +
          `<ICMS><ICMSSN102><orig>0</orig><CSOSN>102</CSOSN></ICMSSN102></ICMS>` +
          `<PIS><PISOutr><CST>49</CST><vBC>0.00</vBC><pPIS>0.00</pPIS><vPIS>0.00</vPIS></PISOutr></PIS>` +
          `<COFINS><COFINSOutr><CST>49</CST><vBC>0.00</vBC><pCOFINS>0.00</pCOFINS><vCOFINS>0.00</vCOFINS></COFINSOutr></COFINS>` +
        `</imposto>` +
      `</det>`
    )
  }).join('')

  // <dest> exige CNPJ/CPF/idEstrangeiro (não é opcional dentro do grupo) — se o cliente não tem
  // documento, omitimos o <dest> inteiro (ele é opcional no nível da infNFe).
  const documentoDest = input.destinatario?.documento ? soNumeros(input.destinatario.documento) : ''
  // Regra padrão nacional: em homologação, o nome do destinatário deve ser literalmente esse
  // texto, senão a Sefaz rejeita (cStat 598) pra deixar claro que é nota de teste sem valor fiscal.
  const nomeDest = input.ambiente === 'homologacao'
    ? 'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL'
    : input.destinatario?.nome
  const destXml = documentoDest ? (() => {
    const tagDoc = documentoDest.length === 11 ? `<CPF>${documentoDest}</CPF>` : `<CNPJ>${documentoDest}</CNPJ>`
    return (
      `<dest>` +
        tagDoc +
        `<xNome>${esc(nomeDest!)}</xNome>` +
        `<indIEDest>9</indIEDest>` +
      `</dest>`
    )
  })() : ''

  const tPag = TP_PAGAMENTO[input.formaPagamento]

  // Sem declaração <?xml?> própria: este XML é embutido como elemento filho dentro do envelope
  // SOAP (enviNFe), e uma segunda declaração aninhada tornaria o documento inteiro malformado.
  const xml =
    `<NFe xmlns="http://www.portalfiscal.inf.br/nfe">` +
      `<infNFe Id="${id}" versao="4.00">` +
        `<ide>` +
          `<cUF>${cUF}</cUF>` +
          `<cNF>${cNF}</cNF>` +
          `<natOp>Venda de mercadoria</natOp>` +
          `<mod>55</mod>` +
          `<serie>${input.serie}</serie>` +
          `<nNF>${input.numero}</nNF>` +
          `<dhEmi>${formatarDataHora(dataEmissao)}</dhEmi>` +
          `<tpNF>1</tpNF>` +
          `<idDest>1</idDest>` +
          `<cMunFG>${input.emitente.endereco.codigoMunicipio}</cMunFG>` +
          `<tpImp>1</tpImp>` +
          `<tpEmis>1</tpEmis>` +
          `<cDV>${chaveAcesso.slice(-1)}</cDV>` +
          `<tpAmb>${tpAmb}</tpAmb>` +
          `<finNFe>1</finNFe>` +
          `<indFinal>1</indFinal>` +
          `<indPres>1</indPres>` +
          `<indIntermed>0</indIntermed>` +
          `<procEmi>0</procEmi>` +
          `<verProc>1.0.0</verProc>` +
        `</ide>` +
        `<emit>` +
          `<CNPJ>${soNumeros(input.emitente.cnpj)}</CNPJ>` +
          `<xNome>${esc(input.emitente.razaoSocial)}</xNome>` +
          `<enderEmit>` +
            `<xLgr>${esc(input.emitente.endereco.logradouro)}</xLgr>` +
            `<nro>${esc(input.emitente.endereco.numero)}</nro>` +
            `<xBairro>${esc(input.emitente.endereco.bairro)}</xBairro>` +
            `<cMun>${input.emitente.endereco.codigoMunicipio}</cMun>` +
            `<xMun>${esc(input.emitente.endereco.nomeMunicipio)}</xMun>` +
            `<UF>${input.emitente.endereco.uf}</UF>` +
            `<CEP>${soNumeros(input.emitente.endereco.cep)}</CEP>` +
            `<cPais>1058</cPais>` +
            `<xPais>Brasil</xPais>` +
          `</enderEmit>` +
          (input.emitente.inscricaoEstadual ? `<IE>${esc(input.emitente.inscricaoEstadual)}</IE>` : `<IE>ISENTO</IE>`) +
          `<CRT>${input.emitente.crt}</CRT>` +
        `</emit>` +
        destXml +
        detXml +
        `<total>` +
          `<ICMSTot>` +
            `<vBC>0.00</vBC>` +
            `<vICMS>0.00</vICMS>` +
            `<vICMSDeson>0.00</vICMSDeson>` +
            `<vFCP>0.00</vFCP>` +
            `<vBCST>0.00</vBCST>` +
            `<vST>0.00</vST>` +
            `<vFCPST>0.00</vFCPST>` +
            `<vFCPSTRet>0.00</vFCPSTRet>` +
            `<vProd>${formatarDecimal(vProdTotal)}</vProd>` +
            `<vFrete>0.00</vFrete>` +
            `<vSeg>0.00</vSeg>` +
            `<vDesc>0.00</vDesc>` +
            `<vII>0.00</vII>` +
            `<vIPI>0.00</vIPI>` +
            `<vIPIDevol>0.00</vIPIDevol>` +
            `<vPIS>0.00</vPIS>` +
            `<vCOFINS>0.00</vCOFINS>` +
            `<vOutro>0.00</vOutro>` +
            `<vNF>${formatarDecimal(vProdTotal)}</vNF>` +
          `</ICMSTot>` +
        `</total>` +
        `<transp><modFrete>9</modFrete></transp>` +
        `<pag><detPag><tPag>${tPag}</tPag><vPag>${formatarDecimal(vProdTotal)}</vPag></detPag></pag>` +
      `</infNFe>` +
    `</NFe>`

  return { xml, chaveAcesso }
}

/**
 * Assina o XML da NF-e (assinatura envelopada). Diferente da NFS-e Nacional (que usa
 * SHA-256/C14N exclusivo), o schema da NF-e (xmldsig-core-schema v1.01) fixa os algoritmos
 * no padrão antigo: SHA-1 e canonicalização C14N não-exclusiva.
 */
export function assinarNfe(xml: string, id: string, cert: CertMaterial): string {
  const sig = new SignedXml({
    privateKey: cert.privateKeyPem,
    publicCert: cert.certificatePem,
    signatureAlgorithm: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
    canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
  })

  sig.addReference({
    xpath: `//*[local-name(.)='infNFe']`,
    digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1',
    transforms: [
      'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
      'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
    ],
    uri: `#${id}`,
  })

  sig.getKeyInfoContent = () => `<X509Data><X509Certificate>${cert.certificatePem.replace(/-----[^-]+-----|\n/g, '')}</X509Certificate></X509Data>`

  sig.computeSignature(xml, {
    location: { reference: `//*[local-name(.)='infNFe']`, action: 'after' },
  })

  return sig.getSignedXml()
}
