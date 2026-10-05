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
  crt: string // 1=Simples Nacional (ME/EPP), 2=Simples excesso sublimite, 3=Normal, 4=MEI (obrigatório para MEI desde 01/04/2025, NT 2024.001)
  endereco: NfeEndereco
}

export interface NfeDestinatario {
  documento?: string
  nome: string
  endereco?: NfeEndereco
}

export interface NfeItem {
  codigo: string
  /** Código de barras; sem ele vai o literal "SEM GTIN" (permitido para produto sem código). */
  gtin?: string | null
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
  // O schema da NF-e (TString) proíbe espaço no início/fim e caracteres de controle: um código de
  // produto gravado com espaços sobrando derruba a nota inteira com a rejeição 225.
  return value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
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
  pix: '99',
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
          `<cEAN>${item.gtin || 'SEM GTIN'}</cEAN>` +
          `<xProd>${esc(item.descricao)}</xProd>` +
          `<NCM>${item.ncm}</NCM>` +
          `<CFOP>${item.cfop}</CFOP>` +
          `<uCom>${esc(item.unidade)}</uCom>` +
          `<qCom>${item.quantidade.toFixed(4)}</qCom>` +
          `<vUnCom>${item.valorUnitario.toFixed(10)}</vUnCom>` +
          `<vProd>${formatarDecimal(vProd)}</vProd>` +
          `<cEANTrib>${item.gtin || 'SEM GTIN'}</cEANTrib>` +
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
    const end = input.destinatario?.endereco
    const enderDestXml = end ? (
      `<enderDest>` +
        `<xLgr>${esc(end.logradouro)}</xLgr>` +
        `<nro>${esc(end.numero)}</nro>` +
        `<xBairro>${esc(end.bairro)}</xBairro>` +
        `<cMun>${end.codigoMunicipio}</cMun>` +
        `<xMun>${esc(end.nomeMunicipio)}</xMun>` +
        `<UF>${end.uf}</UF>` +
        `<CEP>${soNumeros(end.cep)}</CEP>` +
      `</enderDest>`
    ) : ''
    return (
      `<dest>` +
        tagDoc +
        `<xNome>${esc(nomeDest!)}</xNome>` +
        enderDestXml +
        `<indIEDest>9</indIEDest>` +
      `</dest>`
    )
  })() : ''

  const tPag = TP_PAGAMENTO[input.formaPagamento]
  // tPag 99 (outros) exige a descrição em xPag (NT 2020.006); o PIX também sai como 99 + "PIX".
  const xPag = input.formaPagamento === 'pix' ? '<xPag>PIX</xPag>' : tPag === '99' ? '<xPag>Outros</xPag>' : ''

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
        `<pag><detPag><tPag>${tPag}</tPag>${xPag}<vPag>${formatarDecimal(vProdTotal)}</vPag></detPag></pag>` +
        // Optante do Simples Nacional/MEI (CRT 1, 2 ou 4): a frase é obrigatória no documento fiscal
        // (LC 123/2006). infAdic vem logo depois de pag na ordem do schema.
        (['1', '2', '4'].includes(input.emitente.crt)
          ? `<infAdic><infCpl>DOCUMENTO EMITIDO POR ME OU EPP OPTANTE PELO SIMPLES NACIONAL. NAO GERA DIREITO A CREDITO FISCAL DE ICMS, ISS E IPI.</infCpl></infAdic>`
          : '') +
      `</infNFe>` +
    `</NFe>`

  return { xml, chaveAcesso }
}

/**
 * Assinatura envelopada no padrão da NF-e. Diferente da NFS-e Nacional (que usa SHA-256/C14N
 * exclusivo), o schema da NF-e (xmldsig-core-schema v1.01) fixa os algoritmos no padrão antigo:
 * SHA-1 e canonicalização C14N não-exclusiva. Vale tanto pra nota (infNFe) quanto pros eventos
 * (infEvento), que seguem o mesmo schema de assinatura.
 */
function assinarElemento(xml: string, id: string, cert: CertMaterial, elemento: 'infNFe' | 'infEvento'): string {
  const sig = new SignedXml({
    privateKey: cert.privateKeyPem,
    publicCert: cert.certificatePem,
    signatureAlgorithm: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
    canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
  })

  sig.addReference({
    xpath: `//*[local-name(.)='${elemento}']`,
    digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1',
    transforms: [
      'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
      'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
    ],
    uri: `#${id}`,
  })

  sig.getKeyInfoContent = () => `<X509Data><X509Certificate>${cert.certificatePem.replace(/-----[^-]+-----|\n/g, '')}</X509Certificate></X509Data>`

  sig.computeSignature(xml, {
    location: { reference: `//*[local-name(.)='${elemento}']`, action: 'after' },
  })

  return sig.getSignedXml()
}

/** Assina o XML da NF-e. */
export function assinarNfe(xml: string, id: string, cert: CertMaterial): string {
  return assinarElemento(xml, id, cert, 'infNFe')
}

/** Assina o XML de um evento de NF-e (manifestação, cancelamento...). */
export function assinarEventoNfe(xml: string, id: string, cert: CertMaterial): string {
  return assinarElemento(xml, id, cert, 'infEvento')
}

// Manifestação do destinatário (NT 2012.002). Só a Ciência é usada aqui: ela não confirma nem
// recusa a compra, apenas registra que a empresa sabe da nota — e é o que libera o XML completo.
export const TP_EVENTO_CIENCIA = '210210'

/**
 * Data/hora no fuso de Brasília com offset explícito (AAAA-MM-DDThh:mm:ss-03:00), como o schema
 * exige. Recua 1 minuto: se o nosso relógio estiver um pouco à frente do da Sefaz, um dhEvento
 * "no futuro" é rejeitado.
 */
function dataHoraBrasilia(agora = new Date()): string {
  const d = new Date(agora.getTime() - 60_000 - 3 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 19) + '-03:00'
}

export const TP_EVENTO_CANCELAMENTO = '110111'

// cOrgao do evento: 91 = Ambiente Nacional (manifestação do destinatário); os demais eventos
// (como o cancelamento) vão para a Sefaz que autorizou a nota — aqui, SP (35).
const C_ORGAO_AMBIENTE_NACIONAL = '91'
const C_ORGAO_SP = '35'

/** Tira acentos e caracteres de controle e escapa o que é especial em XML. */
function textoParaXml(texto: string): string {
  return texto
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ').trim()
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Monta um evento de NF-e (sem assinatura). Retorna o XML e o Id a assinar. */
function montarEvento(params: {
  cOrgao: string
  tpAmb: '1' | '2'
  cnpjAutor: string
  chaveAcesso: string
  tpEvento: string
  conteudoDetEvento: string
}): { xml: string; id: string } {
  const nSeqEvento = '1'
  const id = `ID${params.tpEvento}${params.chaveAcesso}${nSeqEvento.padStart(2, '0')}`
  const xml =
    `<evento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">` +
      `<infEvento Id="${id}">` +
        `<cOrgao>${params.cOrgao}</cOrgao>` +
        `<tpAmb>${params.tpAmb}</tpAmb>` +
        `<CNPJ>${params.cnpjAutor}</CNPJ>` +
        `<chNFe>${params.chaveAcesso}</chNFe>` +
        `<dhEvento>${dataHoraBrasilia()}</dhEvento>` +
        `<tpEvento>${params.tpEvento}</tpEvento>` +
        `<nSeqEvento>${nSeqEvento}</nSeqEvento>` +
        `<verEvento>1.00</verEvento>` +
        `<detEvento versao="1.00">${params.conteudoDetEvento}</detEvento>` +
      `</infEvento>` +
    `</evento>`
  return { xml, id }
}

/** Evento de Ciência da Operação, registrado no Ambiente Nacional pelo destinatário da nota. */
export function montarEventoCiencia(params: { cnpjDestinatario: string; chaveAcesso: string; tpAmb: '1' | '2' }): { xml: string; id: string } {
  return montarEvento({
    cOrgao: C_ORGAO_AMBIENTE_NACIONAL,
    tpAmb: params.tpAmb,
    cnpjAutor: params.cnpjDestinatario,
    chaveAcesso: params.chaveAcesso,
    tpEvento: TP_EVENTO_CIENCIA,
    conteudoDetEvento: `<descEvento>Ciencia da Operacao</descEvento>`,
  })
}

/**
 * Evento de cancelamento, enviado pelo emitente à Sefaz que autorizou a nota. Precisa do número do
 * protocolo de autorização e de uma justificativa de 15 a 255 caracteres.
 */
export function montarEventoCancelamento(params: {
  cnpjEmitente: string
  chaveAcesso: string
  tpAmb: '1' | '2'
  protocolo: string
  justificativa: string
}): { xml: string; id: string } {
  const xJust = textoParaXml(params.justificativa)
  if (xJust.length < 15 || xJust.length > 255) {
    throw new Error('A justificativa do cancelamento precisa ter entre 15 e 255 caracteres.')
  }
  return montarEvento({
    cOrgao: C_ORGAO_SP,
    tpAmb: params.tpAmb,
    cnpjAutor: params.cnpjEmitente,
    chaveAcesso: params.chaveAcesso,
    tpEvento: TP_EVENTO_CANCELAMENTO,
    conteudoDetEvento: `<descEvento>Cancelamento</descEvento><nProt>${params.protocolo}</nProt><xJust>${xJust}</xJust>`,
  })
}
