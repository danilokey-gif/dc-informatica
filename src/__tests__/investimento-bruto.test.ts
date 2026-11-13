import { describe, it, expect } from 'vitest'
import { resumoInvestimento } from '@/lib/investimento-bruto'

const dia = (s: string) => new Date(`${s}T12:00:00.000Z`)

describe('investimento: valor bruto e imposto', () => {
  const saldos = [
    { id: '0', data: dia('2025-12-31'), valor: 44102.83, rendimentoBruto: null, impostoRetido: null },
    { id: '1', data: dia('2026-06-30'), valor: 83675.42, rendimentoBruto: 909.67, impostoRetido: 0 },
    { id: '2', data: dia('2026-07-31'), valor: 83819.78, rendimentoBruto: 1014.1, impostoRetido: 869.74 },
    { id: '3', data: dia('2026-10-31'), valor: 86301.74, rendimentoBruto: 961.84, impostoRetido: 314.22 },
  ]

  it('soma o IR retido de volta ao saldo para achar o valor bruto', () => {
    const r = resumoInvestimento(saldos)
    expect(r.imposto).toBeCloseTo(1183.96, 2)
    expect(r.valorBruto).toBeCloseTo(86301.74 + 1183.96, 2)
  })

  it('o valor bruto de cada mês só leva o IR retido até aquela data', () => {
    const r = resumoInvestimento(saldos)
    expect(r.linhas.map(l => l.valorBruto)).toEqual([44102.83, 83675.42, 84689.52, 87485.7])
    expect(r.linhas[2].irAcumulado).toBeCloseTo(869.74, 2)
  })

  it('porcentagem = IR retido ÷ rendimento bruto', () => {
    const r = resumoInvestimento(saldos)
    expect(r.rendimentoBruto).toBeCloseTo(2885.61, 2)
    expect(r.percentual!).toBeCloseTo((1183.96 / 2885.61) * 100, 6)
  })

  it('saldo lançado à mão (sem rendimento nem IR) não altera as somas', () => {
    const r = resumoInvestimento([{ id: 'm', data: dia('2026-11-13'), valor: 86653, rendimentoBruto: null, impostoRetido: null }])
    expect(r.imposto).toBe(0)
    expect(r.percentual).toBeNull()
    expect(r.valorBruto).toBe(86653)
  })

  it('sem nenhum saldo não há valor bruto', () => {
    const r = resumoInvestimento([])
    expect(r.valorBruto).toBeNull()
    expect(r.percentual).toBeNull()
  })
})
