import { prisma } from "@/lib/prisma"

export type Aba = 'resumo' | 'servico' | 'produto' | 'devolucao' | 'testes'
export const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

export interface LinhaNota {
  id: string
  /** servico | produto | devolucao | teste (homologação, recusada ou em processamento) */
  grupo: 'servico' | 'produto' | 'devolucao' | 'teste'
  tipoNota: 'NFS-e' | 'NF-e'
  finalidade: string
  numero: string
  serie: string
  data: Date
  mes: number
  cliente: string
  documento: string | null
  valor: number
  status: string
  ambiente: string
  importada: boolean
  observacao: string | null
  linkPdf: string | null
  linkXml: string | null
  linkOrigem: string | null
  rotuloOrigem: string | null
}

/** Mês (1-12) no horário de Brasília. */
const mesBr = (d: Date) => new Date(d.getTime() - 3 * 3600_000).getUTCMonth() + 1

/** Limites do ano no horário de Brasília (UTC-3). */
function limitesDoAno(ano: number) {
  return { gte: new Date(Date.UTC(ano, 0, 1, 3)), lt: new Date(Date.UTC(ano + 1, 0, 1, 3)) }
}

/** Todas as notas emitidas no ano (serviço e produto), já classificadas por aba. Sem carregar os XMLs. */
export async function notasDoAno(ano: number): Promise<LinhaNota[]> {
  const periodo = limitesDoAno(ano)
  const noAno = { OR: [{ dataEmissao: periodo }, { dataEmissao: null, createdAt: periodo }] }

  const [servicos, produtos] = await Promise.all([
    prisma.nfseEmissao.findMany({
      where: noAno,
      select: {
        id: true, numeroNfse: true, numeroDps: true, serieDps: true, status: true, ambiente: true, origem: true,
        chaveAcesso: true, motivoErro: true, motivoCancelamento: true, valorTotal: true, dataEmissao: true, createdAt: true,
        tomadorNome: true, tomadorDocumento: true, serviceOrderId: true,
        serviceOrder: { select: { price: true, customer: { select: { name: true, document: true } } } },
      },
    }),
    prisma.nfeEmissao.findMany({
      where: noAno,
      select: {
        id: true, numero: true, serie: true, status: true, ambiente: true, origem: true, finalidade: true,
        chaveAcesso: true, motivoErro: true, motivoCancelamento: true, valorTotal: true, dataEmissao: true, createdAt: true,
        destinatarioNome: true, destinatarioDocumento: true, saleId: true,
        sale: { select: { total: true, customer: { select: { name: true, document: true } } } },
      },
    }),
  ])

  const teste = (ambiente: string, status: string) => ambiente !== 'producao' || !['AUTORIZADA', 'CANCELADA'].includes(status)

  const linhas: LinhaNota[] = [
    ...servicos.map((n): LinhaNota => {
      const data = n.dataEmissao || n.createdAt
      const temNota = !!n.chaveAcesso && ['AUTORIZADA', 'CANCELADA'].includes(n.status)
      return {
        id: n.id,
        grupo: teste(n.ambiente, n.status) ? 'teste' : 'servico',
        tipoNota: 'NFS-e',
        finalidade: 'SERVICO',
        numero: String(n.numeroNfse ?? n.numeroDps),
        serie: n.numeroNfse ? '' : n.serieDps,
        data,
        mes: mesBr(data),
        cliente: n.serviceOrder?.customer.name || n.tomadorNome || 'Não identificado',
        documento: n.tomadorDocumento || n.serviceOrder?.customer.document || null,
        valor: n.valorTotal ?? n.serviceOrder?.price ?? 0,
        status: n.status,
        ambiente: n.ambiente,
        importada: n.origem !== 'SISTEMA',
        observacao: n.status === 'CANCELADA' ? n.motivoCancelamento : n.motivoErro,
        linkPdf: temNota ? `/notas-fiscais/ver-danfse?id=${n.id}` : null,
        linkXml: temNota ? `/notas-fiscais/ver-xml?tipo=nfse&id=${n.id}` : null,
        linkOrigem: n.serviceOrderId ? `/os/${n.serviceOrderId}/imprimir` : null,
        rotuloOrigem: n.serviceOrderId ? 'OS' : null,
      }
    }),
    ...produtos.map((n): LinhaNota => {
      const data = n.dataEmissao || n.createdAt
      const temNota = !!n.chaveAcesso && ['AUTORIZADA', 'CANCELADA'].includes(n.status)
      const devolucao = n.finalidade.startsWith('DEVOLUCAO')
      return {
        id: n.id,
        grupo: teste(n.ambiente, n.status) ? 'teste' : devolucao ? 'devolucao' : 'produto',
        tipoNota: 'NF-e',
        finalidade: n.finalidade,
        numero: String(n.numero),
        serie: n.serie,
        data,
        mes: mesBr(data),
        cliente: n.sale?.customer?.name || n.destinatarioNome || 'Não identificado',
        documento: n.destinatarioDocumento || n.sale?.customer?.document || null,
        valor: n.valorTotal ?? n.sale?.total ?? 0,
        status: n.status,
        ambiente: n.ambiente,
        importada: n.origem !== 'SISTEMA',
        observacao: devolucao
          ? (n.finalidade === 'DEVOLUCAO_COMPRA' ? 'Devolução ao fornecedor' : 'Devolução do cliente')
          : n.status === 'CANCELADA' ? n.motivoCancelamento : n.motivoErro,
        linkPdf: temNota ? `/notas-fiscais/ver-danfe?id=${n.id}` : null,
        linkXml: temNota ? `/notas-fiscais/ver-xml?tipo=nfe&id=${n.id}` : null,
        linkOrigem: n.saleId ? `/vendas/${n.saleId}/imprimir` : null,
        rotuloOrigem: n.saleId ? 'Venda' : null,
      }
    }),
  ]
  return linhas.sort((a, b) => b.data.getTime() - a.data.getTime())
}

/** Totais do ano e de cada mês: só produção autorizada; devolução de venda desconta. */
export function resumoDoAno(linhas: LinhaNota[]) {
  const validas = linhas.filter(l => l.status === 'AUTORIZADA' && l.grupo !== 'teste')
  const somar = (ls: LinhaNota[]) => ({ qtd: ls.length, valor: ls.reduce((s, l) => s + l.valor, 0) })
  const servicos = validas.filter(l => l.grupo === 'servico')
  const produtos = validas.filter(l => l.grupo === 'produto')
  const devVenda = validas.filter(l => l.finalidade === 'DEVOLUCAO_VENDA')
  const canceladas = (g: LinhaNota['grupo']) => linhas.filter(l => l.grupo === g && l.status === 'CANCELADA').length

  const meses = MESES.map((_, i) => {
    const m = i + 1
    const s = somar(servicos.filter(l => l.mes === m))
    const p = somar(produtos.filter(l => l.mes === m))
    const d = somar(devVenda.filter(l => l.mes === m))
    return { mes: m, servico: s.valor, qtdServico: s.qtd, produto: p.valor, qtdProduto: p.qtd, devolucao: d.valor, total: s.valor + p.valor - d.valor }
  })
  const servico = { ...somar(servicos), canceladas: canceladas('servico') }
  const produto = { ...somar(produtos), canceladas: canceladas('produto') }
  const devolucaoVenda = somar(devVenda)
  return { meses, servico, produto, devolucaoVenda, total: servico.valor + produto.valor - devolucaoVenda.valor }
}
