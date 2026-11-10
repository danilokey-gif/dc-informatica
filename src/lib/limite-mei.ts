/**
 * Limite de faturamento do MEI (receita bruta anual). Até 20% acima do limite o MEI recolhe a
 * diferença e passa a Simples Nacional em janeiro do ano seguinte; acima disso o desenquadramento
 * retroage a janeiro do próprio ano. Se o limite mudar por lei, basta acrescentar o ano aqui.
 *
 * Por decisão do dono, a conta usa só o faturamento COM nota fiscal (NFS-e e NF-e de venda
 * autorizadas no ano). Recebimentos sem nota ficam de fora.
 */
const LIMITE_PADRAO = 81_000
const LIMITES_POR_ANO: Record<number, number> = {}
export const TOLERANCIA = 1.2

export const limiteMei = (ano: number) => LIMITES_POR_ANO[ano] ?? LIMITE_PADRAO

export type SituacaoMei = 'TRANQUILO' | 'ATENCAO' | 'PERTO' | 'ACIMA' | 'ESTOUROU'

export interface ResumoMei {
  ano: number
  limite: number
  teto: number
  /** NF-e de venda emitidas no ano. */
  comercio: number
  /** NFS-e emitidas no ano. */
  servicos: number
  /** Total das notas emitidas no ano: é o valor comparado com o limite. */
  base: number
  /** Quanto dessas vendas/serviços com nota já entrou em dinheiro no ano. */
  recebidoComNota: number
  percentual: number
  restante: number
  /** Só no ano corrente. */
  mediaMensal: number | null
  podeFaturarPorMes: number | null
  projecao: number | null
  situacao: SituacaoMei
}

export function resumoMei(d: {
  ano: number
  /** Data de hoje (Brasília) como AAAA-MM-DD. */
  hoje: string
  notasProduto: number
  notasServico: number
  recebidoComNota: number
}): ResumoMei {
  const limite = limiteMei(d.ano), teto = limite * TOLERANCIA
  const base = d.notasProduto + d.notasServico

  const anoAtual = Number(d.hoje.slice(0, 4)) === d.ano
  let mediaMensal: number | null = null, podeFaturarPorMes: number | null = null, projecao: number | null = null
  if (anoAtual) {
    const inicio = Date.UTC(d.ano, 0, 1), fim = Date.UTC(d.ano + 1, 0, 1)
    const fracao = Math.min(1, Math.max(1 / 365, (Date.parse(d.hoje) + 86_400_000 - inicio) / (fim - inicio)))
    const mesesRestantes = Math.max(0, (1 - fracao) * 12)
    mediaMensal = base / (fracao * 12)
    projecao = base / fracao
    podeFaturarPorMes = mesesRestantes > 0.1 ? Math.max(0, limite - base) / mesesRestantes : null
  }

  const previsto = projecao ?? base
  const situacao: SituacaoMei =
    base > teto ? 'ESTOUROU'
    : base > limite ? 'ACIMA'
    : previsto > limite || base >= limite * 0.9 ? 'PERTO'
    : base >= limite * 0.7 || previsto >= limite * 0.9 ? 'ATENCAO'
    : 'TRANQUILO'

  return {
    ano: d.ano, limite, teto, comercio: d.notasProduto, servicos: d.notasServico, base, recebidoComNota: d.recebidoComNota,
    percentual: (base / limite) * 100, restante: limite - base, mediaMensal, podeFaturarPorMes, projecao, situacao,
  }
}
