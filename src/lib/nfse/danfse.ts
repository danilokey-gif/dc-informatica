/**
 * DANFSe v2.0 — Documento Auxiliar da NFS-e no modelo nacional obrigatório.
 *
 * Segue a Nota Técnica SE/CGNFS-e nº 008/2026, versão 1.02 (14/07/2026): leiaute do Anexo I,
 * posições e tamanhos do item 2.4.5, fontes do item 2.4, sombreamentos do item 2.2.3, marca d'água
 * de cancelamento (2.5.1) e aviso de homologação (2.4.3). Desde 03/08/2026 a API nacional que
 * gerava o DANFSe foi desligada e cada sistema emissor precisa gerá-lo seguindo essa nota.
 *
 * Tudo sai do XML da NFS-e: a NT proíbe imprimir informação que não esteja no arquivo da nota.
 * Por isso este módulo não recebe dados do cadastro do cliente nem da configuração da empresa.
 *
 * As descrições dos códigos vêm do Anexo I do leiaute (anexo_i-sefin_adn-dps_nfse-snnfse-v1-01).
 * Fontes: a NT pede Arial (títulos) e Microsoft Sans Serif (conteúdo); usamos a Helvetica embutida
 * no PDF, que tem as mesmas métricas da Arial e não exige distribuir arquivos de fonte licenciados.
 */
import PDFDocument from 'pdfkit'
import QRCode from 'qrcode'
import fs from 'fs'
import path from 'path'
import tabelas from './tabelas-ibge.json'

// ───────────────────────────── leitura do XML ─────────────────────────────

/** Conteúdo do primeiro grupo <nome>...</nome> (com ou sem atributos). */
function bloco(xml: string | null | undefined, nome: string): string | null {
  if (!xml) return null
  return xml.match(new RegExp(`<${nome}(?:\\s[^>]*)?>([\\s\\S]*?)</${nome}>`))?.[1] ?? null
}

/** Texto da primeira tag folha <nome>...</nome>. */
function tag(xml: string | null | undefined, nome: string): string | null {
  if (!xml) return null
  const v = xml.match(new RegExp(`<${nome}(?:\\s[^>]*)?>([^<]*)</${nome}>`))?.[1]
  return v === undefined ? null : desescapar(v.trim())
}

function desescapar(t: string): string {
  return t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
}

// ───────────────────────── tabelas de códigos (Anexo I) ─────────────────────────

const AMB_GER: Record<string, string> = { '1': 'Sistema Próprio do Município', '2': 'Sefin Nacional NFS-e' }
const TP_AMB: Record<string, string> = { '1': 'Produção', '2': 'Homologação' }
const SITUACAO: Record<string, string> = {
  '100': 'NFS-e Gerada',
  '102': 'NFS-e de Decisão Judicial ou Administrativa',
  '103': 'NFS-e Avulsa',
  '107': 'NFS-e MEI',
}
const TP_EMIT: Record<string, string> = { '1': 'Prestador', '2': 'Tomador', '3': 'Intermediário' }
const FIN_NFSE: Record<string, string> = { '0': 'NFS-e regular' }
const OP_SIMP_NAC: Record<string, string> = {
  '1': 'Não Optante',
  '2': 'Optante - Microempreendedor Individual (MEI)',
  '3': 'Optante - Microempresa ou Empresa de Pequeno Porte (ME/EPP)',
}
const REG_AP_TRIB_SN: Record<string, string> = {
  '1': 'Regime de apuração dos tributos federais e municipal pelo SN',
  '2': 'Regime de apuração dos tributos federais pelo SN e o ISSQN pela NFS-e conforme respectiva legislação municipal do tributo',
  '3': 'Regime de apuração dos tributos federais e municipal pela NFS-e conforme respectivas legislações federal e municipal de cada tributo',
}
const REG_ESP_TRIB: Record<string, string> = {
  '0': 'Nenhum', '1': 'Ato Cooperado (Cooperativa)', '2': 'Estimativa', '3': 'Microempresa Municipal',
  '4': 'Notário ou Registrador', '5': 'Profissional Autônomo', '6': 'Sociedade de Profissionais', '9': 'Outros',
}
const TRIB_ISSQN: Record<string, string> = { '1': 'Operação Tributável', '2': 'Imunidade', '3': 'Exportação de Serviço', '4': 'Não Incidência' }
const TP_IMUNIDADE: Record<string, string> = {
  '0': 'Imunidade (tipo não informado na nota de origem)',
  '1': 'Patrimônio, renda ou serviços, uns dos outros',
  '2': 'Entidades religiosas e templos de qualquer culto',
  '3': 'Patrimônio, renda ou serviços dos partidos políticos, entidades sindicais e instituições de educação e assistência social',
  '4': 'Livros, jornais, periódicos e o papel destinado a sua impressão',
  '5': 'Fonogramas e videofonogramas musicais produzidos no Brasil',
}
const TP_SUSP: Record<string, string> = {
  '1': 'Exigibilidade Suspensa por Decisão Judicial',
  '2': 'Exigibilidade Suspensa por Processo Administrativo',
}
const TP_RET_ISSQN: Record<string, string> = { '1': 'Não Retido', '2': 'Retido pelo Tomador', '3': 'Retido pelo Intermediário' }
const TP_BM: Record<string, string> = { '1': 'Isenção', '2': 'Redução da BC em %', '3': 'Redução da BC em R$', '4': 'Alíquota Diferenciada' }
const TP_RET_PIS_COFINS: Record<string, string> = {
  '0': 'PIS/COFINS/CSLL Não Retidos', '1': 'PIS/COFINS Retido', '2': 'PIS/COFINS Não Retido',
  '3': 'PIS/COFINS/CSLL Retidos', '4': 'PIS/COFINS Retidos, CSLL Não Retido', '5': 'PIS Retido, COFINS/CSLL Não Retido',
  '6': 'COFINS Retido, PIS/CSLL Não Retido', '7': 'PIS Não Retido, COFINS/CSLL Retidos',
  '8': 'PIS/COFINS Não Retidos, CSLL Retido', '9': 'COFINS Não Retido, PIS/CSLL Retidos',
}

const descricao = (tabela: Record<string, string>, codigo: string | null) => (codigo ? tabela[codigo] ?? codigo : null)

// ─────────────────────────────── formatação ───────────────────────────────

const TRACO = '-'

function documento(d: string | null): string | null {
  if (!d) return null
  if (/^\d{14}$/.test(d)) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  if (/^\d{11}$/.test(d)) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  return d
}

function telefone(f: string | null): string | null {
  if (!f) return null
  const d = f.replace(/\D/g, '')
  if (d.length === 10) return d.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3')
  if (d.length === 11) return d.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3')
  return f
}

const cep = (c: string | null) => (c && /^\d{8}$/.test(c) ? c.replace(/^(\d{2})(\d{3})(\d{3})$/, '$1.$2-$3') : c)

/** Data e hora no fuso informado no próprio XML (ex.: 2026-09-28T08:33:28-03:00 → 28/09/2026 08:33:28). */
function dataHora(iso: string | null): string | null {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2}:\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}` : null
}

function data(iso: string | null): string | null {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null
}

function numero(v: string | null): number | null {
  if (v === null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

const dinheiro = (v: number | null) => (v === null ? null : `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
const percentual = (v: number | null) => (v === null ? null : `${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`)

const MUNICIPIOS = tabelas.municipios as Record<string, string>
const UFS = tabelas.ufs as Record<string, string>

function municipioUf(cMun: string | null, nome?: string | null): string | null {
  if (!cMun && !nome) return null
  const n = nome || (cMun ? MUNICIPIOS[cMun] : null) || cMun
  const uf = cMun ? UFS[cMun.slice(0, 2)] : null
  return uf ? `${n} / ${uf}` : n
}

const juntar = (...partes: (string | null | undefined)[]) => partes.filter(p => p && p.trim()).join(' / ') || null
const juntarVirgula = (...partes: (string | null | undefined)[]) => partes.filter(p => p && p.trim()).join(', ') || null

function codigoTributacao(cTribNac: string | null, cTribMun: string | null): string | null {
  if (!cTribNac) return cTribMun
  const nac = /^\d{6}$/.test(cTribNac) ? cTribNac.replace(/^(\d{2})(\d{2})(\d{2})$/, '$1.$2.$3') : cTribNac
  return cTribMun ? `${nac} / ${cTribMun}` : nac
}

const nbs = (c: string | null) => (c && /^\d{9}$/.test(c) ? c.replace(/^(\d)(\d{4})(\d{2})(\d{2})$/, '$1.$2.$3.$4') : c)

function somar(...valores: (number | null)[]): number | null {
  const presentes = valores.filter((v): v is number => v !== null)
  return presentes.length ? presentes.reduce((a, b) => a + b, 0) : null
}

// ───────────────────────── dados do DANFSe, a partir do XML ─────────────────────────

interface Pessoa {
  documento: string | null
  inscricaoMunicipal: string | null
  telefone: string | null
  nome: string | null
  municipioUf: string | null
  codIbgeCep: string | null
  endereco: string | null
  email: string | null
}

export interface DadosDanfse {
  ambienteHomologacao: boolean
  cabecalho: { municipio: string | null; ambienteGerador: string | null; tipoAmbiente: string | null }
  chaveAcesso: string
  numeroNfse: string | null
  competencia: string | null
  dhProc: string | null
  numeroDps: string | null
  serieDps: string | null
  dhEmiDps: string | null
  emitente: string | null
  situacao: string | null
  finalidade: string | null
  prestador: Pessoa & { simplesNacional: string | null; regimeApuracaoSn: string | null }
  tomador: Pessoa | null
  /** 'proprio-tomador' = o XML indica que o destinatário é o tomador (indDest = 0). */
  destinatario: Pessoa | 'proprio-tomador' | null
  intermediario: Pessoa | null
  servico: { codigoTributacao: string | null; nbs: string | null; localPrestacao: string | null; descricaoCodigo: string | null; descricao: string | null }
  issqn: null | {
    tipoTributacao: string | null; localIncidencia: string | null; regimeEspecial: string | null; imunidade: string | null
    suspensao: string | null; processoSuspensao: string | null; beneficio: string | null; calculoBm: string | null
    deducoes: string | null; descontoIncondicionado: string | null; bc: string | null; aliquota: string | null
    retencao: string | null; issqnApurado: string | null
  }
  federal: { irrf: string | null; cpRetida: string | null; contribSociaisRetidas: string | null; pis: string | null; cofins: string | null; descricaoRetidas: string | null; imprimirPisCofins: boolean }
  ibscbs: {
    cstClassTrib: string | null; indicadorOperacao: string | null; exclusoesReducoes: string | null; bcAposExclusoes: string | null
    reducoesAliquota: string | null; aliquotaIbs: string | null; aliqEfetMun: string | null; valorIbsMun: string | null
    aliqEfetUf: string | null; valorIbsUf: string | null; totalIbs: string | null; aliquotaCbs: string | null
    aliqEfetCbs: string | null; totalCbs: string | null
  }
  totais: { valorServico: string | null; descontoIncondicionado: string | null; descontoCondicionado: string | null; totalRetencoes: string | null; valorLiquido: string | null; totalIbsCbs: string | null; valorLiquidoComIbsCbs: string | null }
  informacoesComplementares: string
}

function pessoa(grupo: string | null, extras: { nome?: string | null } = {}): Pessoa | null {
  if (!grupo) return null
  const end = bloco(grupo, 'end')
  const endNac = bloco(end, 'endNac')
  const endExt = bloco(end, 'endExt')
  const cMun = tag(endNac, 'cMun')
  return {
    documento: documento(tag(grupo, 'CNPJ') || tag(grupo, 'CPF')) || tag(grupo, 'NIF'),
    inscricaoMunicipal: tag(grupo, 'IM'),
    telefone: telefone(tag(grupo, 'fone')),
    nome: tag(grupo, 'xNome') || extras.nome || null,
    municipioUf: endExt ? tag(endExt, 'xCidade') : municipioUf(cMun),
    codIbgeCep: endExt ? juntar(tag(endExt, 'cPais'), tag(endExt, 'cEndPost')) : juntar(cMun, cep(tag(endNac, 'CEP'))),
    endereco: end ? juntarVirgula(tag(end, 'xLgr'), tag(end, 'nro'), tag(end, 'xCpl'), tag(end, 'xBairro')) : null,
    email: tag(grupo, 'email'),
  }
}

export function extrairDadosDanfse(xml: string): DadosDanfse {
  const infNFSe = bloco(xml, 'infNFSe') || ''
  const infDPS = bloco(infNFSe, 'infDPS') || ''
  // Grupos da própria NFS-e (fora da DPS): emit, valores e IBSCBS calculados pela Sefin.
  const nfseSemDps = infNFSe.replace(/<DPS[\s>][\s\S]*<\/DPS>/, '')

  const chaveAcesso = xml.match(/<infNFSe[^>]*Id="NFS(\d{50})"/)?.[1] || ''
  const tpAmb = tag(infDPS, 'tpAmb')
  const emit = bloco(nfseSemDps, 'emit')
  const emitEnder = bloco(emit, 'enderNac')
  const cTribNac = tag(infDPS, 'cTribNac')

  // ── prestador: grupo prest da DPS; o que a DPS não traz (nome, endereço) vem do grupo emit,
  //    que a Sefin preenche com o cadastro do emitente quando ele é o próprio prestador.
  const prest = bloco(infDPS, 'prest') || ''
  const regTrib = bloco(prest, 'regTrib')
  const prestPessoa = pessoa(prest)!
  const prestadorEhEmitente = (tag(infDPS, 'tpEmit') || '1') === '1'
  const prestador = {
    ...prestPessoa,
    documento: prestPessoa.documento || (prestadorEhEmitente ? documento(tag(emit, 'CNPJ') || tag(emit, 'CPF')) : null),
    telefone: prestPessoa.telefone || (prestadorEhEmitente ? telefone(tag(emit, 'fone')) : null),
    nome: prestPessoa.nome || (prestadorEhEmitente ? tag(emit, 'xNome') : null),
    email: prestPessoa.email || (prestadorEhEmitente ? tag(emit, 'email') : null),
    municipioUf: prestPessoa.municipioUf || (prestadorEhEmitente && emitEnder ? municipioUf(tag(emitEnder, 'cMun'), tag(nfseSemDps, 'xLocEmi')) : null),
    codIbgeCep: prestPessoa.codIbgeCep || (prestadorEhEmitente && emitEnder ? juntar(tag(emitEnder, 'cMun'), cep(tag(emitEnder, 'CEP'))) : null),
    endereco: prestPessoa.endereco || (prestadorEhEmitente && emitEnder
      ? juntarVirgula(tag(emitEnder, 'xLgr'), tag(emitEnder, 'nro'), tag(emitEnder, 'xCpl'), tag(emitEnder, 'xBairro')) : null),
    simplesNacional: descricao(OP_SIMP_NAC, tag(regTrib, 'opSimpNac')),
    regimeApuracaoSn: descricao(REG_AP_TRIB_SN, tag(regTrib, 'regApTribSN')),
  }

  // ── destinatário (grupo IBSCBS da DPS)
  const ibsDps = bloco(infDPS, 'IBSCBS')
  const dest = bloco(ibsDps, 'dest')
  const destinatario: DadosDanfse['destinatario'] = dest ? pessoa(dest) : (tag(ibsDps, 'indDest') === '0' ? 'proprio-tomador' : null)

  // ── serviço
  const serv = bloco(infDPS, 'serv') || ''
  const cServ = bloco(serv, 'cServ')
  const locPrest = bloco(serv, 'locPrest')
  const cLocPrestacao = tag(locPrest, 'cLocPrestacao')
  const cPaisPrestacao = tag(locPrest, 'cPaisPrestacao')
  const xTribMun = tag(nfseSemDps, 'xTribMun')

  // ── valores da DPS
  const valoresDps = bloco(infDPS, 'valores') || ''
  const trib = bloco(valoresDps, 'trib')
  const tribMun = bloco(trib, 'tribMun')
  const tribFed = bloco(trib, 'tribFed')
  const piscofins = bloco(tribFed, 'piscofins')
  const descontos = bloco(valoresDps, 'vDescCondIncond')
  const valoresNfse = bloco(nfseSemDps, 'valores')

  const vDescIncond = numero(tag(descontos, 'vDescIncond'))

  // ── ISSQN (Nota 4: sem grupo de tributação municipal → bloco compacto)
  let issqn: DadosDanfse['issqn'] = null
  if (tribMun) {
    const exigSusp = bloco(tribMun, 'exigSusp')
    const cLocIncid = tag(nfseSemDps, 'cLocIncid')
    issqn = {
      tipoTributacao: descricao(TRIB_ISSQN, tag(tribMun, 'tribISSQN')),
      localIncidencia: juntar(tag(nfseSemDps, 'xLocIncid'), cLocIncid ? UFS[cLocIncid.slice(0, 2)] : null, tag(tribMun, 'cPaisResult') || (cLocIncid ? 'BR' : null)),
      regimeEspecial: descricao(REG_ESP_TRIB, tag(regTrib, 'regEspTrib')),
      imunidade: descricao(TP_IMUNIDADE, tag(tribMun, 'tpImunidade')),
      suspensao: descricao(TP_SUSP, tag(exigSusp, 'tpSusp')),
      processoSuspensao: tag(exigSusp, 'nProcesso'),
      beneficio: descricao(TP_BM, tag(valoresNfse, 'tpBM')),
      calculoBm: dinheiro(numero(tag(valoresNfse, 'vCalcBM')) ?? numero(tag(bloco(tribMun, 'BM'), 'vRedBCBM'))),
      deducoes: dinheiro(numero(tag(bloco(valoresDps, 'vDedRed'), 'vDR')) ?? somar(numero(tag(valoresNfse, 'vCalcDR')), numero(tag(bloco(nfseSemDps, 'IBSCBS'), 'vCalcReeRepRes')))),
      descontoIncondicionado: dinheiro(vDescIncond),
      bc: dinheiro(numero(tag(valoresNfse, 'vBC'))),
      aliquota: percentual(numero(tag(valoresNfse, 'pAliqAplic'))),
      retencao: descricao(TP_RET_ISSQN, tag(tribMun, 'tpRetISSQN')),
      issqnApurado: dinheiro(numero(tag(valoresNfse, 'vISSQN'))),
    }
  }

  // ── tributação federal (NT 008 v1.02: com tpRetPisCofins = 1, PIS/COFINS entram nas retidas)
  const tpRetPisCofins = tag(piscofins, 'tpRetPisCofins')
  const vPis = numero(tag(piscofins, 'vPis'))
  const vCofins = numero(tag(piscofins, 'vCofins'))
  const vRetCSLL = numero(tag(tribFed, 'vRetCSLL'))
  const pisCofinsRetido = tpRetPisCofins === '1'
  const competencia = tag(infDPS, 'dCompet')
  const federal = {
    irrf: dinheiro(numero(tag(tribFed, 'vRetIRRF'))),
    cpRetida: dinheiro(numero(tag(tribFed, 'vRetCP'))),
    contribSociaisRetidas: dinheiro(pisCofinsRetido ? somar(vRetCSLL, vPis, vCofins) : vRetCSLL),
    pis: dinheiro(pisCofinsRetido ? (vPis === null ? null : 0) : vPis),
    cofins: dinheiro(pisCofinsRetido ? (vCofins === null ? null : 0) : vCofins),
    descricaoRetidas: descricao(TP_RET_PIS_COFINS, tpRetPisCofins),
    // Nota 6: a linha de PIS/COFINS só é impressa para competências até o fim de 2026.
    imprimirPisCofins: !competencia || Number(competencia.slice(0, 4)) <= 2026,
  }

  // ── IBS/CBS (ausentes nas notas de MEI até 2027: campos ficam com traço, conforme Nota 12)
  const ibsNfse = bloco(nfseSemDps, 'IBSCBS')
  const ibsValores = bloco(ibsNfse, 'valores')
  const uf = bloco(ibsValores, 'uf')
  const mun = bloco(ibsValores, 'mun')
  const fed = bloco(ibsValores, 'fed')
  const totCIBS = bloco(ibsNfse, 'totCIBS')
  const gIBS = bloco(totCIBS, 'gIBS')
  const gCBS = bloco(totCIBS, 'gCBS')
  const gIBSCBS = bloco(bloco(bloco(ibsDps, 'valores'), 'trib'), 'gIBSCBS')
  const cLocalidadeIncid = tag(ibsNfse, 'cLocalidadeIncid')
  const vIBSTot = numero(tag(gIBS, 'vIBSTot'))
  const vCBS = numero(tag(gCBS, 'vCBS'))
  const ibscbs = {
    cstClassTrib: juntar(tag(gIBSCBS, 'CST'), tag(gIBSCBS, 'cClassTrib')),
    indicadorOperacao: juntar(tag(ibsDps, 'cIndOp'), cLocalidadeIncid, tag(ibsNfse, 'xLocalidadeIncid'), cLocalidadeIncid ? UFS[cLocalidadeIncid.slice(0, 2)] : null),
    exclusoesReducoes: ibsNfse ? dinheiro(somar(vDescIncond, numero(tag(ibsValores, 'vCalcReeRepRes')), numero(tag(valoresNfse, 'vISSQN')), vPis, vCofins)) : null,
    bcAposExclusoes: dinheiro(numero(tag(ibsValores, 'vBC'))),
    reducoesAliquota: ibsNfse ? juntar(percentual(numero(tag(uf, 'pRedAliqUF'))), percentual(numero(tag(mun, 'pRedAliqMun'))), percentual(numero(tag(fed, 'pRedAliqCBS')))) : null,
    aliquotaIbs: ibsNfse ? juntar(percentual(numero(tag(uf, 'pIBSUF'))), percentual(numero(tag(mun, 'pIBSMun')))) : null,
    aliqEfetMun: percentual(numero(tag(mun, 'pAliqEfetMun'))),
    valorIbsMun: dinheiro(numero(tag(bloco(gIBS, 'gIBSMunTot'), 'vIBSMun'))),
    aliqEfetUf: percentual(numero(tag(uf, 'pAliqEfetUF'))),
    valorIbsUf: dinheiro(numero(tag(bloco(gIBS, 'gIBSUFTot'), 'vIBSUF'))),
    totalIbs: dinheiro(vIBSTot),
    aliquotaCbs: percentual(numero(tag(fed, 'pCBS'))),
    aliqEfetCbs: percentual(numero(tag(fed, 'pAliqEfetCBS'))),
    totalCbs: dinheiro(vCBS),
  }

  // ── totais
  const totais = {
    valorServico: dinheiro(numero(tag(bloco(valoresDps, 'vServPrest'), 'vServ'))),
    descontoIncondicionado: dinheiro(vDescIncond),
    descontoCondicionado: dinheiro(numero(tag(descontos, 'vDescCond'))),
    totalRetencoes: dinheiro(numero(tag(valoresNfse, 'vTotalRet'))),
    valorLiquido: dinheiro(numero(tag(valoresNfse, 'vLiq'))),
    totalIbsCbs: dinheiro(somar(vIBSTot, vCBS)),
    valorLiquidoComIbsCbs: dinheiro(numero(tag(totCIBS, 'vTotNF'))),
  }

  // ── informações complementares (ordem e rótulos do item 2.4.5) + totais aproximados (Nota 10)
  const infoCompl = bloco(serv, 'infoCompl')
  const partes: string[] = []
  const adicionar = (rotulo: string, valor: string | null) => { if (valor) partes.push(`${rotulo} ${valor}`) }
  adicionar('Inf. Cont.:', tag(infoCompl, 'xInfComp'))
  adicionar('NFS-e Subst.:', tag(bloco(infDPS, 'subst'), 'chSubstda'))
  adicionar('Doc. Ref.:', tag(infoCompl, 'docRef'))
  adicionar('Cod. Obra:', tag(bloco(serv, 'obra'), 'cObra'))
  adicionar('Insc. Imob.:', tag(bloco(ibsDps, 'imovel'), 'inscImobFisc') || tag(bloco(serv, 'obra'), 'inscImobFisc'))
  adicionar('Cod. Evt.:', tag(bloco(serv, 'atvEvento'), 'idAtvEvt'))
  adicionar('Doc. Tec.:', tag(infoCompl, 'idDocTec'))
  adicionar('Núm. Ped.:', tag(infoCompl, 'xPed'))
  adicionar('Item Ped.:', tag(bloco(infoCompl, 'gItemPed'), 'xItemPed'))
  adicionar('Inf. A. T. Mun.:', tag(nfseSemDps, 'xOutInf'))

  const totTrib = bloco(trib, 'totTrib')
  const vTotTrib = bloco(totTrib, 'vTotTrib')
  const pTotTrib = bloco(totTrib, 'pTotTrib')
  const pTotTribSN = numero(tag(totTrib, 'pTotTribSN'))
  let totaisAprox: string
  if (vTotTrib) {
    totaisAprox = `Federais: ${dinheiro(numero(tag(vTotTrib, 'vTotTribFed'))) ?? TRACO} ; Estaduais: ${dinheiro(numero(tag(vTotTrib, 'vTotTribEst'))) ?? TRACO} ; Municipais: ${dinheiro(numero(tag(vTotTrib, 'vTotTribMun'))) ?? TRACO}`
  } else if (pTotTrib) {
    totaisAprox = `Federais: ${percentual(numero(tag(pTotTrib, 'pTotTribFed'))) ?? TRACO} ; Estaduais: ${percentual(numero(tag(pTotTrib, 'pTotTribEst'))) ?? TRACO} ; Municipais: ${percentual(numero(tag(pTotTrib, 'pTotTribMun'))) ?? TRACO}`
  } else {
    totaisAprox = `Federais: ${TRACO} ; Estaduais: ${TRACO} ; Municipais: ${TRACO}${pTotTribSN !== null ? ` (Simples Nacional: ${percentual(pTotTribSN)})` : ''}`
  }
  const linhaTotais = `Totais Aproximados dos Tributos cfe. Lei nº 12.741/2012: ${totaisAprox}`

  return {
    ambienteHomologacao: tpAmb === '2',
    cabecalho: {
      // Item 2.4.5: não exibir o município quando o item do código de tributação nacional for 99.
      municipio: cTribNac?.startsWith('99') ? null : municipioUf(tag(emitEnder, 'cMun'), tag(nfseSemDps, 'xLocEmi')),
      ambienteGerador: descricao(AMB_GER, tag(nfseSemDps, 'ambGer')),
      tipoAmbiente: descricao(TP_AMB, tpAmb),
    },
    chaveAcesso,
    numeroNfse: tag(nfseSemDps, 'nNFSe'),
    competencia: data(competencia),
    dhProc: dataHora(tag(nfseSemDps, 'dhProc')),
    numeroDps: tag(infDPS, 'nDPS'),
    serieDps: tag(infDPS, 'serie'),
    dhEmiDps: dataHora(tag(infDPS, 'dhEmi')),
    emitente: descricao(TP_EMIT, tag(infDPS, 'tpEmit')),
    situacao: descricao(SITUACAO, tag(nfseSemDps, 'cStat')),
    finalidade: descricao(FIN_NFSE, tag(ibsDps, 'finNFSe')),
    prestador,
    tomador: pessoa(bloco(infDPS, 'toma')),
    destinatario,
    intermediario: pessoa(bloco(infDPS, 'interm')),
    servico: {
      codigoTributacao: codigoTributacao(cTribNac, tag(cServ, 'cTribMun')),
      nbs: nbs(tag(cServ, 'cNBS')),
      localPrestacao: cPaisPrestacao
        ? juntar(tag(nfseSemDps, 'xLocPrestacao'), cPaisPrestacao)
        : juntar(tag(nfseSemDps, 'xLocPrestacao'), cLocPrestacao ? UFS[cLocPrestacao.slice(0, 2)] : null, cLocPrestacao ? 'BR' : null),
      // Item 2.4.5: SE xTribMun <> "" ENTÃO descrição municipal SENÃO descrição nacional.
      descricaoCodigo: xTribMun || tag(nfseSemDps, 'xTribNac'),
      descricao: tag(cServ, 'xDescServ'),
    },
    issqn,
    federal,
    ibscbs,
    totais,
    informacoesComplementares: [...partes, linhaTotais].join(' | '),
  }
}

// ──────────────────────────────── desenho ────────────────────────────────

const CM = 72 / 2.54
const X1 = 0.30, X2 = 5.41, X3 = 10.51, X4 = 15.62
const COL = 5.09, COL2 = 10.19, LARG = 20.40
const CINZA_FUNDO = '#F2F2F2' // 5% de densidade (item 2.2.3)
const CINZA_MARCA = '#A6A6A6' // K35 (item 2.5.1)
const LIMITE_INFERIOR = 29.40 // borda da página a 0,20 cm do fim da folha A4 (29,70 cm)

function carregarLogo(): Buffer | null {
  try {
    return fs.readFileSync(path.join(process.cwd(), 'public', 'logo-nfse-horizontal.png'))
  } catch {
    return null
  }
}

/** Texto em uma linha, cortado com reticências se não couber (item 2.4.5, v1.02). */
function linha(doc: PDFKit.PDFDocument, texto: string, x: number, y: number, largura: number, fonte: string, tamanho: number, opcoes: PDFKit.Mixins.TextOptions = {}) {
  doc.font(fonte).fontSize(tamanho).fillColor('#000000')
  // A altura de uma linha é o que faz o pdfkit cortar com reticências em vez de quebrar a linha
  // por cima do campo de baixo.
  doc.text(texto, x * CM, y * CM, { width: largura * CM, height: tamanho * 1.15, ellipsis: true, ...opcoes })
}

/** Campo com título (6 pt negrito, iniciais maiúsculas) e conteúdo (7 pt) — itens 2.4.2 e 2.4.4. */
function campo(doc: PDFKit.PDFDocument, x: number, y: number, largura: number, rotulo: string, valor: string | null, opcoes: { sombreado?: boolean; altura?: number; destaque?: boolean } = {}) {
  if (opcoes.sombreado) doc.rect(x * CM, y * CM, largura * CM, (opcoes.altura ?? 0.63) * CM).fill(CINZA_FUNDO)
  // Títulos em destaque vêm escritos como no Anexo I ("EMITENTE DA NFS-e", "NÚMERO DA NFS-E"...).
  if (opcoes.destaque) linha(doc, rotulo, x + 0.08, y + 0.05, largura - 0.16, 'Helvetica-Bold', 7)
  else linha(doc, rotulo, x + 0.08, y + 0.07, largura - 0.16, 'Helvetica-Bold', 6)
  linha(doc, valor || TRACO, x + 0.08, y + 0.33, largura - 0.16, 'Helvetica', 7)
}

/** Título do bloco: 7 pt negrito em caixa alta, com fundo cinza (itens 2.2.3 e 2.4.1). */
function tituloBloco(doc: PDFKit.PDFDocument, y: number, titulo: string, altura = 0.63) {
  doc.rect(X1 * CM, y * CM, COL * CM, altura * CM).fill(CINZA_FUNDO)
  linha(doc, titulo.toUpperCase(), X1 + 0.08, y + 0.12, COL - 0.16, 'Helvetica-Bold', 7)
}

function divisoria(doc: PDFKit.PDFDocument, y: number) {
  doc.moveTo(X1 * CM, y * CM).lineTo((X1 + LARG) * CM, y * CM).lineWidth(0.5).strokeColor('#000000').stroke()
}

/** Bloco reduzido a uma linha de aviso (Notas 2, 3 e 4): altura mínima 0,32 cm. */
function blocoCompacto(doc: PDFKit.PDFDocument, y: number, texto: string): number {
  divisoria(doc, y)
  linha(doc, texto, X1, y + 0.07, LARG, 'Helvetica', 7, { align: 'center' })
  return y + 0.34
}

function blocoPessoa(doc: PDFKit.PDFDocument, y: number, titulo: string, p: Pessoa, comInscricao: boolean): number {
  divisoria(doc, y)
  tituloBloco(doc, y, titulo)
  campo(doc, X2, y, COL, 'CNPJ / CPF / NIF', p.documento)
  if (comInscricao) campo(doc, X3, y, COL, 'Indicador Municipal (Inscrição)', p.inscricaoMunicipal)
  campo(doc, X4, y, COL, 'Telefone', p.telefone)
  campo(doc, X1, y + 0.64, COL2, 'Nome / Nome Empresarial', p.nome)
  campo(doc, X3, y + 0.64, COL, 'Município / Sigla UF', p.municipioUf)
  campo(doc, X4, y + 0.64, COL, 'Código IBGE / CEP', p.codIbgeCep)
  campo(doc, X1, y + 1.30, COL2, 'Endereço', p.endereco)
  campo(doc, X3, y + 1.30, COL2, 'E-mail', p.email)
  return y + 1.94
}

/** Gera o PDF do DANFSe v2.0 a partir do XML da NFS-e autorizada. */
export async function gerarDanfsePdf(xmlNfse: string, opcoes: { cancelada?: boolean } = {}): Promise<Buffer> {
  const d = extrairDadosDanfse(xmlNfse)
  const doc = new PDFDocument({ size: 'A4', margin: 0, info: { Title: `DANFSe ${d.numeroNfse ?? ''}`.trim(), Creator: 'Dc Informática' } })
  const chunks: Buffer[] = []
  const pronto = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', c => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })

  // Borda da página: 1 ponto, a 0,20 cm da borda da folha (itens 2.2.2 e 2.2.3).
  doc.rect(0.20 * CM, 0.20 * CM, 20.60 * CM, (LIMITE_INFERIOR - 0.20 + 0.10) * CM).lineWidth(1).strokeColor('#000000').stroke()

  // ── cabeçalho (item 2.4.3)
  doc.rect(X1 * CM, 0.30 * CM, LARG * CM, 1.16 * CM).fill(CINZA_FUNDO)
  const logo = carregarLogo()
  if (logo) doc.image(logo, 0.49 * CM, 0.44 * CM, { fit: [4.00 * CM, 0.85 * CM], valign: 'center' })
  linha(doc, 'DANFSe v2.0', X2, 0.42, COL2, 'Helvetica-Bold', 9, { align: 'center' })
  linha(doc, 'Documento Auxiliar da NFS-e', X2, 0.78, COL2, 'Helvetica-Bold', 9, { align: 'center' })
  if (d.ambienteHomologacao) {
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#FF0000')
      .text('NFS-e SEM VALIDADE JURÍDICA', X2 * CM, 1.12 * CM, { width: COL2 * CM, align: 'center', lineBreak: false })
  }
  if (d.cabecalho.municipio) linha(doc, `Município: ${d.cabecalho.municipio}`, X4, 0.38, COL, 'Helvetica', 8)
  linha(doc, `Ambiente Gerador: ${d.cabecalho.ambienteGerador ?? TRACO}`, X4, 0.97, COL, 'Helvetica', 6)
  linha(doc, `Tipo de Ambiente: ${d.cabecalho.tipoAmbiente ?? TRACO}`, X4, 1.22, COL, 'Helvetica', 6)

  // ── dados da NFS-e (títulos em 7 pt caixa alta — item 2.4.2)
  divisoria(doc, 1.48)
  campo(doc, X1, 1.48, 15.30, 'CHAVE DE ACESSO DA NFS-E', d.chaveAcesso, { destaque: true })
  campo(doc, X1, 2.27, COL, 'NÚMERO DA NFS-E', d.numeroNfse, { destaque: true })
  campo(doc, X2, 2.27, COL, 'COMPETÊNCIA DA NFS-E', d.competencia, { destaque: true })
  campo(doc, X3, 2.27, COL, 'DATA E HORA DA EMISSÃO DA NFS-E', d.dhProc, { destaque: true })
  campo(doc, X1, 2.96, COL, 'NÚMERO DA DPS', d.numeroDps, { destaque: true })
  campo(doc, X2, 2.96, COL, 'SÉRIE DA DPS', d.serieDps, { destaque: true })
  campo(doc, X3, 2.96, COL, 'DATA E HORA DA EMISSÃO DA DPS', d.dhEmiDps, { destaque: true })
  campo(doc, X1, 3.65, COL, 'EMITENTE DA NFS-e', d.emitente, { destaque: true, sombreado: true, altura: 0.67 })
  campo(doc, X2, 3.65, COL, 'SITUAÇÃO DA NFS-e', d.situacao, { destaque: true })
  campo(doc, X3, 3.65, COL, 'FINALIDADE', d.finalidade, { destaque: true })

  if (d.chaveAcesso) {
    const qr = await QRCode.toBuffer(`https://www.nfse.gov.br/ConsultaPublica/?tpc=1&chave=${d.chaveAcesso}`, { margin: 0, width: 360, errorCorrectionLevel: 'M' })
    doc.image(qr, 17.48 * CM, 1.67 * CM, { width: 1.52 * CM, height: 1.52 * CM })
  }
  doc.font('Helvetica').fontSize(6).fillColor('#000000').text(
    'A autenticidade desta NFS-e pode ser verificada pela leitura deste código QR ou pela consulta da chave de acesso no portal nacional da NFS-e',
    15.80 * CM, 3.36 * CM, { width: 4.72 * CM, align: 'justify', lineGap: 0.2 },
  )

  // ── prestador / fornecedor
  let y = 4.34
  divisoria(doc, y)
  tituloBloco(doc, y, 'Prestador / Fornecedor')
  campo(doc, X2, y, COL, 'CNPJ / CPF / NIF', d.prestador.documento)
  campo(doc, X3, y, COL, 'Indicador Municipal (Inscrição)', d.prestador.inscricaoMunicipal)
  campo(doc, X4, y, COL, 'Telefone', d.prestador.telefone)
  campo(doc, X1, y + 0.64, COL2, 'Nome / Nome Empresarial', d.prestador.nome)
  campo(doc, X3, y + 0.64, COL, 'Município / Sigla UF', d.prestador.municipioUf)
  campo(doc, X4, y + 0.64, COL, 'Código IBGE / CEP', d.prestador.codIbgeCep)
  campo(doc, X1, y + 1.28, COL2, 'Endereço', d.prestador.endereco)
  campo(doc, X3, y + 1.28, COL2, 'E-mail', d.prestador.email)
  campo(doc, X1, y + 1.94, COL, 'Simples Nacional na Data de Competência', d.prestador.simplesNacional)
  campo(doc, X2, y + 1.94, COL2, 'Regime de Apuração Tributária pelo SN', d.prestador.regimeApuracaoSn)
  y += 2.58

  // ── tomador, destinatário e intermediário (Notas 2 e 3)
  y = d.tomador ? blocoPessoa(doc, y, 'Tomador / Adquirente', d.tomador, true) : blocoCompacto(doc, y, 'TOMADOR/ADQUIRENTE DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e')
  if (d.destinatario === 'proprio-tomador') y = blocoCompacto(doc, y, 'O DESTINATÁRIO É O PRÓPRIO TOMADOR/ADQUIRENTE DA OPERAÇÃO')
  else if (d.destinatario) y = blocoPessoa(doc, y, 'Destinatário da Operação', d.destinatario, false)
  else y = blocoCompacto(doc, y, 'DESTINATÁRIO DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e')
  y = d.intermediario ? blocoPessoa(doc, y, 'Intermediário da Operação', d.intermediario, true) : blocoCompacto(doc, y, 'INTERMEDIÁRIO DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e')

  // ── altura dos blocos de baixo, para distribuir o espaço que sobra entre a descrição do
  //    serviço e as informações complementares (itens 2.3.1 a 2.3.3)
  const alturaIssqn = d.issqn ? 2.59 : 0.34
  const alturaFederal = d.federal.imprimirPisCofins ? 1.30 : 0.65
  const alturaIbs = 2.58
  const alturaTotais = 1.37
  const alturaTituloInfo = 0.41
  const inicioDescricao = y + 1.05
  const espacoLivre = LIMITE_INFERIOR - inicioDescricao - alturaIssqn - alturaFederal - alturaIbs - alturaTotais - alturaTituloInfo

  doc.font('Helvetica').fontSize(7)
  const larguraTexto = (LARG - 0.16) * CM
  const alturaTextoDescricao = d.servico.descricao ? doc.heightOfString(d.servico.descricao, { width: larguraTexto }) / CM : 0
  const alturaTextoInfo = doc.heightOfString(d.informacoesComplementares, { width: larguraTexto }) / CM
  // A descrição ganha o espaço de que precisa, sem tirar das informações complementares o mínimo
  // para o texto delas (e nunca menos que 1 cm para cada um).
  const minimoInfo = Math.max(1.0, Math.min(alturaTextoInfo + 0.2, espacoLivre / 2))
  // Pelo menos a altura que a descrição tem no modelo do Anexo I (cerca de 2,4 cm).
  const alturaDescricao = Math.max(2.4, Math.min(alturaTextoDescricao + 0.45, espacoLivre - minimoInfo))

  // ── serviço prestado
  divisoria(doc, y)
  tituloBloco(doc, y, 'Serviço Prestado')
  campo(doc, X2, y, COL, 'Código de Tributação Nacional / Municipal', d.servico.codigoTributacao)
  campo(doc, X3, y, COL, 'Código da NBS', d.servico.nbs)
  campo(doc, X4, y, COL, 'Local da Prestação / Sigla UF / País', d.servico.localPrestacao)
  // Descrição do código de tributação: sem título (item 2.4.5).
  linha(doc, d.servico.descricaoCodigo || TRACO, X1 + 0.08, y + 0.70, LARG - 0.16, 'Helvetica', 7)
  linha(doc, 'Descrição do Serviço', X1 + 0.08, y + 1.05, LARG - 0.16, 'Helvetica-Bold', 6)
  doc.font('Helvetica').fontSize(7).fillColor('#000000').text(d.servico.descricao || TRACO, (X1 + 0.08) * CM, (y + 1.31) * CM, {
    width: larguraTexto, height: (alturaDescricao - 0.30) * CM, ellipsis: true,
  })
  y = inicioDescricao + alturaDescricao

  // ── tributação municipal (ISSQN) — Nota 4
  if (d.issqn) {
    const t = d.issqn
    divisoria(doc, y)
    tituloBloco(doc, y, 'Tributação Municipal (ISSQN)')
    campo(doc, X2, y, COL, 'Tipo de Tributação do ISSQN', t.tipoTributacao)
    campo(doc, X3, y, COL2, 'Município / Sigla UF / País de Incidência do ISSQN', t.localIncidencia)
    campo(doc, X1, y + 0.65, COL, 'Regime Especial de Tributação do ISSQN', t.regimeEspecial)
    campo(doc, X2, y + 0.65, COL, 'Tipo de Imunidade do ISSQN', t.imunidade)
    campo(doc, X3, y + 0.65, COL, 'Suspensão da Exigibilidade do ISSQN', t.suspensao)
    campo(doc, X4, y + 0.65, COL, 'Número Processo Suspensão', t.processoSuspensao)
    campo(doc, X1, y + 1.30, COL, 'Benefício Municipal', t.beneficio)
    campo(doc, X2, y + 1.30, COL, 'Cálculo do BM', t.calculoBm)
    campo(doc, X3, y + 1.30, COL, 'Total Deduções/Reduções', t.deducoes)
    campo(doc, X4, y + 1.30, COL, 'Desconto Incondicionado', t.descontoIncondicionado)
    campo(doc, X1, y + 1.94, COL, 'BC ISSQN', t.bc)
    campo(doc, X2, y + 1.94, COL, 'Alíquota Aplicada', t.aliquota)
    campo(doc, X3, y + 1.94, COL, 'Retenção do ISSQN', t.retencao)
    campo(doc, X4, y + 1.94, COL, 'ISSQN Apurado', t.issqnApurado)
    y += 2.59
  } else {
    y = blocoCompacto(doc, y, 'TRIBUTAÇÃO MUNICIPAL (ISSQN) - OPERAÇÃO NÃO SUJEITA AO ISSQN')
  }

  // ── tributação federal (exceto CBS)
  divisoria(doc, y)
  tituloBloco(doc, y, 'Tributação Federal (Exceto CBS)')
  campo(doc, X2, y, COL, 'IRRF', d.federal.irrf)
  campo(doc, X3, y, COL, 'Contribuição Previdenciária - Retida', d.federal.cpRetida)
  campo(doc, X4, y, COL, 'Contribuições Sociais - Retidas', d.federal.contribSociaisRetidas)
  if (d.federal.imprimirPisCofins) {
    campo(doc, X1, y + 0.65, COL, 'PIS - Débito Apuração Própria', d.federal.pis)
    campo(doc, X2, y + 0.65, COL, 'COFINS - Débito Apuração Própria', d.federal.cofins)
    campo(doc, X3, y + 0.65, COL2, 'Descrição Contrib. Sociais - Retidas', d.federal.descricaoRetidas)
  }
  y += alturaFederal

  // ── tributação IBS / CBS
  const i = d.ibscbs
  divisoria(doc, y)
  tituloBloco(doc, y, 'Tributação IBS / CBS')
  campo(doc, X2, y, COL, 'CST / cClassTrib', i.cstClassTrib)
  campo(doc, X3, y, COL2, 'Indicador de Operação / Código IBGE Incidência / Município Incidência / Sigla UF', i.indicadorOperacao)
  campo(doc, X1, y + 0.64, COL, 'Exclusões e Reduções da Base de Cálculo', i.exclusoesReducoes)
  campo(doc, X2, y + 0.64, COL, 'Base de Cálculo Após Exclusões e Reduções', i.bcAposExclusoes)
  campo(doc, X3, y + 0.64, COL, 'Red. Alíquota IBS / Red. Alíquota CBS', i.reducoesAliquota)
  campo(doc, X4, y + 0.64, COL, 'Alíquota - IBS UF / IBS Mun', i.aliquotaIbs)
  campo(doc, X1, y + 1.29, COL, 'Alíq. Efetiva Municipal - IBS', i.aliqEfetMun)
  campo(doc, X2, y + 1.29, COL, 'Valor Apurado Municipal - IBS', i.valorIbsMun)
  campo(doc, X3, y + 1.29, COL, 'Alíq. Efetiva Estadual - IBS', i.aliqEfetUf)
  campo(doc, X4, y + 1.29, COL, 'Valor Apurado Estadual - IBS', i.valorIbsUf)
  campo(doc, X1, y + 1.94, COL, 'Valor Total Apurado - IBS', i.totalIbs)
  campo(doc, X2, y + 1.94, COL, 'Alíquota - CBS', i.aliquotaCbs)
  campo(doc, X3, y + 1.94, COL, 'Alíquota Efetiva - CBS', i.aliqEfetCbs)
  campo(doc, X4, y + 1.94, COL, 'Valor Total Apurado - CBS', i.totalCbs)
  y += alturaIbs

  // ── valor total da NFS-e
  const tt = d.totais
  divisoria(doc, y)
  tituloBloco(doc, y, 'Valor Total da NFS-e', 0.67)
  campo(doc, X2, y, COL, 'VALOR DA OPERAÇÃO / SERVIÇO', tt.valorServico, { destaque: true })
  campo(doc, X3, y, COL, 'Desconto Incondicionado', tt.descontoIncondicionado)
  campo(doc, X4, y, COL, 'Desconto Condicionado', tt.descontoCondicionado)
  campo(doc, X1, y + 0.69, COL, 'Total das Retenções (ISSQN / Federais)', tt.totalRetencoes)
  campo(doc, X2, y + 0.69, COL, 'VALOR LÍQUIDO DA NFS-e', tt.valorLiquido, { destaque: true })
  campo(doc, X3, y + 0.69, COL, 'Total do IBS/CBS', tt.totalIbsCbs)
  campo(doc, X4, y + 0.69, COL, 'VALOR LÍQUIDO DA NFS-e + IBS/CBS', tt.valorLiquidoComIbsCbs, { destaque: true, sombreado: true, altura: 0.67 })
  y += alturaTotais

  // ── informações complementares: ocupam o resto da página (o canhoto, opcional, não é usado)
  divisoria(doc, y)
  tituloBloco(doc, y, 'Informações Complementares', 0.39)
  doc.font('Helvetica').fontSize(7).fillColor('#000000').text(d.informacoesComplementares, (X1 + 0.08) * CM, (y + 0.46) * CM, {
    width: larguraTexto, height: (LIMITE_INFERIOR - y - 0.50) * CM, ellipsis: true,
  })

  // ── marca d'água de cancelamento (item 2.5.1): diagonal, Arial ≥ 50 pt, cinza K35
  if (opcoes.cancelada) {
    doc.save()
    doc.rotate(-55, { origin: [10.5 * CM, 14.85 * CM] })
    doc.font('Helvetica').fontSize(110).fillColor(CINZA_MARCA).fillOpacity(0.55)
      .text('CANCELADA', 0, 14.85 * CM - 55, { width: 21 * CM, align: 'center', lineBreak: false })
    doc.restore()
  }

  doc.end()
  return pronto
}
