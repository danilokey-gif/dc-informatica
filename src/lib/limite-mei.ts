/**
 * Limite de faturamento do MEI (receita bruta anual). Até 20% acima do limite o MEI recolhe a
 * diferença e passa a Simples Nacional em janeiro do ano seguinte; acima disso o desenquadramento
 * retroage a janeiro do próprio ano. Se o limite mudar por lei, basta acrescentar o ano aqui.
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
  /** Faturamento recebido no ano (com nota + sem nota; reembolsos ficam de fora). */
  faturado: number
  comercio: number
  servicos: number
  /** Notas emitidas no ano + serviços sem nota: a mesma conta pela data da nota. */
  porNotas: number
  /** Maior dos dois critérios: é o que define a cor do aviso. */
  base: number
  percentual: number
  restante: number
  aReceberNoAno: number
  /** Só no ano corrente. */
  mesesRestantes: number | null
  mediaMensal: number | null
  podeFaturarPorMes: number | null
  projecao: number | null
  situacao: SituacaoMei
}

export function resumoMei(d: {
  ano: number
  /** Data de hoje (Brasília) como AAAA-MM-DD. */
  hoje: string
  comercio: number
  servicos: number
  semNota: number
  notasEmitidas: number
  aReceberNoAno: number
}): ResumoMei {
  const limite = limiteMei(d.ano), teto = limite * TOLERANCIA
  const faturado = d.comercio + d.servicos
  const porNotas = d.notasEmitidas + d.semNota
  const base = Math.max(faturado, porNotas)

  const anoAtual = Number(d.hoje.slice(0, 4)) === d.ano
  let mesesRestantes: number | null = null, mediaMensal: number | null = null, podeFaturarPorMes: number | null = null, projecao: number | null = null
  if (anoAtual) {
    const inicio = Date.UTC(d.ano, 0, 1), fim = Date.UTC(d.ano + 1, 0, 1)
    const fracao = Math.min(1, Math.max(1 / 365, (Date.parse(d.hoje) + 86_400_000 - inicio) / (fim - inicio)))
    mesesRestantes = Math.max(0, (1 - fracao) * 12)
    mediaMensal = base / (fracao * 12)
    // No ritmo do ano, mas nunca menos do que já está contratado a receber até dezembro.
    projecao = Math.max(base / fracao, base + d.aReceberNoAno)
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
    ano: d.ano, limite, teto, faturado, comercio: d.comercio, servicos: d.servicos, porNotas, base,
    percentual: (base / limite) * 100, restante: limite - base, aReceberNoAno: d.aReceberNoAno,
    mesesRestantes, mediaMensal, podeFaturarPorMes, projecao, situacao,
  }
}
