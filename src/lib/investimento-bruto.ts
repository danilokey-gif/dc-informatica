/**
 * Valor bruto e imposto do investimento (Caixinha/RDB). O saldo que o banco mostra já vem com o IR
 * descontado nas renovações do RDB. Somando de volta o IR retido, sabemos quanto o dinheiro teria se
 * nenhum imposto tivesse sido descontado, e o IR retido sobre o rendimento bruto dá a porcentagem.
 *
 * Só conta o que o extrato da Caixinha informou (a partir de 01/01/2026): saldos lançados à mão não
 * trazem rendimento bruto nem IR, e o imposto de antes do primeiro extrato não é conhecido.
 */
export interface SaldoComImposto {
  data: Date
  valor: number
  rendimentoBruto: number | null
  impostoRetido: number | null
}

const centavos = (v: number) => Math.round(v * 100) / 100

export function resumoInvestimento<T extends SaldoComImposto>(saldosEmOrdemCrescente: T[]) {
  let ir = 0, bruto = 0
  const linhas = saldosEmOrdemCrescente.map(s => {
    ir += s.impostoRetido ?? 0
    bruto += s.rendimentoBruto ?? 0
    return { ...s, irAcumulado: centavos(ir), rendimentoAcumulado: centavos(bruto), valorBruto: centavos(s.valor + ir) }
  })
  const ultima = linhas[linhas.length - 1]
  return {
    linhas,
    rendimentoBruto: centavos(bruto),
    imposto: centavos(ir),
    /** IR retido ÷ rendimento bruto, em %. Nulo enquanto não há rendimento bruto informado. */
    percentual: bruto > 0 ? (ir / bruto) * 100 : null,
    /** Saldo mais o IR já retido. */
    valorBruto: ultima ? ultima.valorBruto : null,
  }
}
