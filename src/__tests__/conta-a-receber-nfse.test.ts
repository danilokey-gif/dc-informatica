import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { situacaoContasDaOs, montarContaAReceberNfse, FORMA_CONTA_AUTOMATICA } from '@/lib/nfse/conta-a-receber'

describe('conta a receber criada ao emitir a NFS-e', () => {
  const base = {
    numeroNfse: '301', chaveAcesso: '35290052211222333000181000000000030126111111111111', cliente: 'Cliente de Teste',
    valor: 135, dataEmissao: new Date('2026-11-13T19:30:00Z'), customerId: 'c1', serviceOrderId: 'os1', categoryId: 'cat1',
  }

  it('nasce pendente, com a forma "NFS-e" e ligada à OS e ao cliente', () => {
    const c = montarContaAReceberNfse(base)
    expect(c).toMatchObject({ type: 'RECEITA', status: 'PENDENTE', amount: 135, paymentMethod: FORMA_CONTA_AUTOMATICA, customerId: 'c1', serviceOrderId: 'os1', categoryId: 'cat1' })
    expect(c.description).toBe('NFS-e 301 — Cliente de Teste')
    expect(c.notes).toContain(base.chaveAcesso)
  })

  it('vence no dia da emissão no horário de Brasília', () => {
    // 22h de Brasília do dia 13 já é dia 14 em UTC: o vencimento continua sendo dia 13.
    expect(montarContaAReceberNfse({ ...base, dataEmissao: new Date('2026-11-14T01:30:00Z') }).dueDate.toISOString()).toBe('2026-11-13T12:00:00.000Z')
    expect(montarContaAReceberNfse(base).dueDate.toISOString()).toBe('2026-11-13T12:00:00.000Z')
  })

  it('sem chave de acesso a observação não quebra', () => {
    expect(montarContaAReceberNfse({ ...base, chaveAcesso: null }).notes).toBe('NFS-e nº 301. Conta criada automaticamente ao emitir a nota.')
  })
})

describe('situação das contas a receber de uma OS', () => {
  const rec = (status: string, paymentMethod: string | null) => ({ type: 'RECEITA', status, paymentMethod })

  it('sem nenhuma conta: o formulário de gerar fica liberado', () => {
    expect(situacaoContasDaOs([])).toEqual({ temConta: false, soAutomatica: false, jaDefinida: false })
  })
  it('só a conta automática pendente: ainda dá para parcelar (ela é substituída)', () => {
    expect(situacaoContasDaOs([rec('PENDENTE', 'NFS-e')])).toEqual({ temConta: true, soAutomatica: true, jaDefinida: false })
  })
  it('conta automática já paga conta como definida (não é substituída)', () => {
    expect(situacaoContasDaOs([rec('PAGO', 'NFS-e')])).toMatchObject({ soAutomatica: false, jaDefinida: true })
  })
  it('parcelamento ou conta lançada à mão conta como definida', () => {
    expect(situacaoContasDaOs([rec('PENDENTE', 'Boleto (3x)'), rec('PENDENTE', 'Boleto (3x)'), rec('PENDENTE', 'Boleto (3x)')]).jaDefinida).toBe(true)
    expect(situacaoContasDaOs([rec('PENDENTE', 'PIX')]).jaDefinida).toBe(true)
  })
  it('conta cancelada e lançamentos que não são receita não contam', () => {
    expect(situacaoContasDaOs([rec('CANCELADO', 'NFS-e'), { type: 'DESPESA', status: 'PENDENTE', paymentMethod: null }]).temConta).toBe(false)
  })
})
