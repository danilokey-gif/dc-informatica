/**
 * Leitura do "Extrato de Rendimentos – Caixinhas PJ" do Nubank (PDF).
 *
 * Linhas do extrato: "DD/MM/AAAA <movimentação> R$ ...". Movimentações:
 * - "Compra por aplicação": dinheiro que entrou na caixinha;
 * - "Rendimento até essa data": rendimento bruto do mês;
 * - "Liquidação" (bruto, IR, IOF, líquido): resgate. Quando vem seguida, na mesma data, de uma
 *   "Compra por aplicação" do mesmo valor líquido, é só a renovação automática do RDB (o dinheiro não
 *   sai da caixinha); nesse caso conta apenas o IR/IOF descontado.
 */
export interface MovimentoCaixinha {
  data: string // AAAA-MM-DD
  tipo: 'APLICACAO' | 'RESGATE' | 'RENDIMENTO' | 'RENOVACAO'
  valor: number // aplicação/resgate: líquido; rendimento: bruto; renovação: líquido reaplicado
  imposto: number // IR + IOF descontados (liquidações)
}

export interface ExtratoCaixinha {
  inicio: string
  fim: string
  saldoFinal: number
  movimentos: MovimentoCaixinha[]
  /** Saldo calculado no fim de cada mês com rendimento, do primeiro ao último. */
  saldosMensais: { data: string; saldo: number; rendimento: number; imposto: number }[]
  saldoInicial: number
}

const MESES: Record<string, string> = { JAN: '01', FEV: '02', MAR: '03', ABR: '04', MAI: '05', JUN: '06', JUL: '07', AGO: '08', SET: '09', OUT: '10', NOV: '11', DEZ: '12' }
const valorBr = (s: string) => Number(s.replace(/\./g, '').replace(',', '.'))
const dataIso = (dmy: string) => `${dmy.slice(6, 10)}-${dmy.slice(3, 5)}-${dmy.slice(0, 2)}`
const centavos = (v: number) => Math.round(v * 100) / 100

export function lerExtratoCaixinha(textoBruto: string): ExtratoCaixinha {
  const texto = textoBruto.replace(/\s+/g, ' ')
  if (!/Caixinhas PJ|Extrato de Rendimentos/i.test(texto)) throw new Error('Este PDF não parece ser o "Extrato de Rendimentos – Caixinhas PJ" do Nubank.')

  const periodo = texto.match(/Período:\s*(\d{2})\s+([A-Z]{3})\s+(\d{4})\s+a\s+(\d{2})\s+([A-Z]{3})\s+(\d{4})/i)
  const saldo = texto.match(/Saldo no final do período:\s*R\$\s*([\d.]+,\d{2})/i)
  if (!periodo || !saldo) throw new Error('Não encontrei o período ou o saldo final no extrato.')
  const inicio = `${periodo[3]}-${MESES[periodo[2].toUpperCase()]}-${periodo[1]}`
  const fim = `${periodo[6]}-${MESES[periodo[5].toUpperCase()]}-${periodo[4]}`

  // Só a parte de "Transações concluídas" (as em processamento não entram no saldo).
  const concluidas = texto.split(/Transações em processamento/i)[0]
  const linhas = [...concluidas.matchAll(/(\d{2}\/\d{2}\/\d{4})\s+((?:(?!R\$)[^\d])+?)\s+((?:R\$\s*[\d.]+,\d{2}\s*)+)/g)]
  const brutos: { data: string; rotulo: string; valores: number[] }[] = linhas.map(m => ({
    data: dataIso(m[1]),
    rotulo: m[2].trim().toLowerCase(),
    valores: [...m[3].matchAll(/R\$\s*([\d.]+,\d{2})/g)].map(v => valorBr(v[1])),
  }))

  const movimentos: MovimentoCaixinha[] = []
  for (let i = 0; i < brutos.length; i++) {
    const l = brutos[i]
    if (l.rotulo.startsWith('rendimento')) {
      movimentos.push({ data: l.data, tipo: 'RENDIMENTO', valor: l.valores[0], imposto: 0 })
    } else if (l.rotulo.startsWith('liquida') || l.rotulo.includes('resgate')) {
      const [bruto, ir = 0, iof = 0, liquido = bruto - ir - iof] = l.valores
      const prox = brutos[i + 1]
      const renovacao = prox && prox.data === l.data && prox.rotulo.startsWith('compra') && Math.abs(prox.valores[prox.valores.length - 1] - liquido) < 0.01
      movimentos.push({ data: l.data, tipo: renovacao ? 'RENOVACAO' : 'RESGATE', valor: liquido, imposto: centavos(ir + iof) })
      if (renovacao) i++ // a "compra" seguinte é a reaplicação do mesmo dinheiro
    } else if (l.rotulo.startsWith('compra')) {
      movimentos.push({ data: l.data, tipo: 'APLICACAO', valor: l.valores[l.valores.length - 1], imposto: 0 })
    }
  }

  // Efeito de cada movimento no saldo: aplicação +, resgate −, rendimento +, imposto −.
  const efeito = (m: MovimentoCaixinha) => (m.tipo === 'APLICACAO' ? m.valor : m.tipo === 'RESGATE' ? -m.valor : m.tipo === 'RENDIMENTO' ? m.valor : 0) - m.imposto
  const saldoFinal = valorBr(saldo[1])
  const saldoInicial = centavos(saldoFinal - movimentos.reduce((s, m) => s + efeito(m), 0))

  const saldosMensais: ExtratoCaixinha['saldosMensais'] = []
  let corrente = saldoInicial
  let impostoMes = 0
  for (const m of [...movimentos].sort((a, b) => a.data.localeCompare(b.data))) {
    corrente += efeito(m)
    impostoMes += m.imposto
    if (m.tipo === 'RENDIMENTO') {
      saldosMensais.push({ data: m.data, saldo: centavos(corrente), rendimento: m.valor, imposto: centavos(impostoMes) })
      impostoMes = 0
    }
  }
  return { inicio, fim, saldoFinal, movimentos, saldosMensais, saldoInicial }
}
