import { describe, it, expect } from 'vitest'
import { lerExtratoCaixinha } from '@/lib/caixinha-nubank'

// Texto fictício no formato do extrato "Caixinhas PJ" (valores inventados).
const extrato = (linhas: string, saldoFinal = '1.100,00') =>
  `Extrato de Rendimentos - Caixinhas PJ Período: 01 JAN 2026 a 31 JAN 2026 Transações concluídas ${linhas} ` +
  `Saldo no final do período: R$ ${saldoFinal} Transações em processamento 05/02/2026 Compra por aplicação R$ 999,00`

describe('leitura do extrato da Caixinha (PDF do Nubank)', () => {
  it('rejeita PDF que não é o extrato', () => {
    expect(() => lerExtratoCaixinha('Fatura do cartão')).toThrow(/não parece/)
  })

  it('rejeita extrato sem período ou saldo', () => {
    expect(() => lerExtratoCaixinha('Extrato de Rendimentos - Caixinhas PJ')).toThrow(/período ou o saldo/)
  })

  it('lê período, aplicação, rendimento e calcula saldo inicial', () => {
    const r = lerExtratoCaixinha(extrato(
      '10/01/2026 Compra por aplicação R$ 100,00 31/01/2026 Rendimento até essa data R$ 10,00'))
    expect(r.inicio).toBe('2026-01-01')
    expect(r.fim).toBe('2026-01-31')
    expect(r.saldoFinal).toBe(1100)
    expect(r.movimentos.map(m => m.tipo)).toEqual(['APLICACAO', 'RENDIMENTO'])
    expect(r.saldoInicial).toBe(990) // 1100 − 100 − 10
    expect(r.saldosMensais).toEqual([{ data: '2026-01-31', saldo: 1100, rendimento: 10, imposto: 0 }])
  })

  it('ignora transações em processamento', () => {
    const r = lerExtratoCaixinha(extrato('31/01/2026 Rendimento até essa data R$ 10,00'))
    expect(r.movimentos).toHaveLength(1) // a compra de R$ 999 está em processamento
  })

  it('liquidação seguida de compra do mesmo líquido é renovação: só o IR/IOF reduz o saldo', () => {
    const r = lerExtratoCaixinha(extrato(
      '15/01/2026 Liquidação R$ 1.000,00 R$ 20,00 R$ 0,00 R$ 980,00 15/01/2026 Compra por aplicação R$ 980,00 ' +
      '31/01/2026 Rendimento até essa data R$ 50,00', '1.030,00'))
    expect(r.movimentos.map(m => m.tipo)).toEqual(['RENOVACAO', 'RENDIMENTO'])
    expect(r.movimentos[0].imposto).toBe(20)
    expect(r.saldoInicial).toBe(1000) // 1030 − 50 + 20
    expect(r.saldosMensais[0]).toMatchObject({ saldo: 1030, rendimento: 50, imposto: 20 })
  })

  it('liquidação sem reaplicação é resgate (dinheiro sai da caixinha)', () => {
    const r = lerExtratoCaixinha(extrato(
      '15/01/2026 Liquidação R$ 500,00 R$ 10,00 R$ 0,00 R$ 490,00 31/01/2026 Rendimento até essa data R$ 5,00', '600,00'))
    expect(r.movimentos[0]).toMatchObject({ tipo: 'RESGATE', valor: 490, imposto: 10 })
    expect(r.saldoInicial).toBe(1095) // 600 − 5 + 490 + 10
  })
})
