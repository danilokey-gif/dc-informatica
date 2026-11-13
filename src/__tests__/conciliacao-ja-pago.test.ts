import { describe, it, expect } from 'vitest'
import { acharLancamentoJaPago } from '@/lib/conciliacao'

const dia = (s: string) => new Date(`${s}T12:00:00.000Z`)
const conta = (id: string, extra: Partial<{ status: string; paymentMethod: string | null; dueDate: Date; paidDate: Date | null }> = {}) =>
  ({ id, status: 'PAGO', paymentMethod: 'Pix', dueDate: dia('2026-11-13'), paidDate: dia('2026-11-16'), ...extra })
const sempre = () => true
const nunca = () => false

describe('extrato do banco × lançamento já pago', () => {
  it('quando quem pagou confere, confirma o lançamento mais próximo da data', () => {
    const a = conta('a', { paidDate: dia('2026-11-10') }), b = conta('b', { paidDate: dia('2026-11-15') })
    expect(acharLancamentoJaPago([a, b], dia('2026-11-16'), sempre)?.id).toBe('b')
  })

  it('baixa manual na mesma data do banco vale mesmo que o nome de quem pagou não confira', () => {
    expect(acharLancamentoJaPago([conta('manual')], dia('2026-11-16'), nunca)?.id).toBe('manual')
    expect(acharLancamentoJaPago([conta('manual')], dia('2026-11-17'), nunca)?.id).toBe('manual') // 1 dia de folga
  })

  it('sem conferir o pagador, dois candidatos no mesmo dia: não escolhe (evita juntar lançamentos diferentes)', () => {
    expect(acharLancamentoJaPago([conta('a'), conta('b')], dia('2026-11-16'), nunca)).toBeUndefined()
  })

  it('sem conferir o pagador e com datas diferentes: não junta (o dinheiro pode ser de outro pagamento)', () => {
    expect(acharLancamentoJaPago([conta('a', { paidDate: dia('2026-11-10') })], dia('2026-11-16'), nunca)).toBeUndefined()
  })

  it('usa a data do pagamento, não a do vencimento', () => {
    // Venceu em 13/11, foi baixada em 28/11: o banco de 28/11 confirma; o de 16/11 está fora da janela.
    const c = conta('c', { dueDate: dia('2026-11-13'), paidDate: dia('2026-11-28') })
    expect(acharLancamentoJaPago([c], dia('2026-11-28'), nunca)?.id).toBe('c')
  })

  it('lançamento sem data de pagamento cai na data de vencimento', () => {
    const c = conta('c', { paidDate: null, dueDate: dia('2026-11-16') })
    expect(acharLancamentoJaPago([c], dia('2026-11-16'), sempre)?.id).toBe('c')
    expect(acharLancamentoJaPago([c], dia('2026-11-16'), nunca)).toBeUndefined() // sem data de pagamento, só vale se o pagador conferir
  })

  it('ignora pendentes, lançamentos que já vieram do banco e datas muito distantes', () => {
    expect(acharLancamentoJaPago([conta('p', { status: 'PENDENTE' })], dia('2026-11-16'), sempre)).toBeUndefined()
    expect(acharLancamentoJaPago([conta('b', { paymentMethod: 'Transferência/Bancário' })], dia('2026-11-16'), sempre)).toBeUndefined()
    expect(acharLancamentoJaPago([conta('longe', { paidDate: dia('2026-09-01') })], dia('2026-11-16'), sempre)).toBeUndefined()
  })
})
