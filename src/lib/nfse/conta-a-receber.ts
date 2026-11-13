import { prisma } from '@/lib/prisma'

/**
 * Conta a receber criada sozinha quando uma NFS-e é emitida. Segue o padrão das notas trazidas do
 * governo: forma "NFS-e", descrição "NFS-e <nº> — <cliente>", pendente até alguém dar baixa em
 * Financeiro → A receber ou o extrato do banco (OFX) reconhecer o pagamento.
 */
export const FORMA_CONTA_AUTOMATICA = 'NFS-e'

interface TransacaoDaOs { type: string; status: string; paymentMethod: string | null }

/**
 * Situação das contas a receber de uma OS. A conta automática (uma só, pendente, forma "NFS-e") pode ser
 * trocada por um parcelamento ou por outra forma de pagamento; uma conta lançada à mão não é mexida.
 */
export function situacaoContasDaOs(transacoes: TransacaoDaOs[]) {
  const receitas = transacoes.filter(t => t.type === 'RECEITA' && t.status !== 'CANCELADO')
  const soAutomatica = receitas.length === 1 && receitas[0].status === 'PENDENTE' && receitas[0].paymentMethod === FORMA_CONTA_AUTOMATICA
  return { temConta: receitas.length > 0, soAutomatica, jaDefinida: receitas.length > 0 && !soAutomatica }
}

/** Data (AAAA-MM-DD) no horário de Brasília. */
const diaEmBrasilia = (d: Date) => new Date(d.getTime() - 3 * 3600_000).toISOString().slice(0, 10)

export function montarContaAReceberNfse(d: {
  numeroNfse: string
  chaveAcesso: string | null
  cliente: string
  valor: number
  dataEmissao: Date
  customerId: string
  serviceOrderId: string
  categoryId: string | null
}) {
  return {
    type: 'RECEITA' as const,
    status: 'PENDENTE' as const,
    description: `NFS-e ${d.numeroNfse} — ${d.cliente}`,
    amount: d.valor,
    // Vence no dia da emissão (data "pura" ao meio-dia UTC, como as demais). Dá para editar a data
    // do vencimento na própria conta quando o combinado for outro (ex.: boleto para daqui a 10 dias).
    dueDate: new Date(`${diaEmBrasilia(d.dataEmissao)}T12:00:00.000Z`),
    paymentMethod: FORMA_CONTA_AUTOMATICA,
    customerId: d.customerId,
    serviceOrderId: d.serviceOrderId,
    categoryId: d.categoryId,
    notes: `NFS-e nº ${d.numeroNfse}${d.chaveAcesso ? ` — chave ${d.chaveAcesso}` : ''}. Conta criada automaticamente ao emitir a nota.`,
  }
}

/** Cria a conta a receber da nota, a menos que a OS (ou a própria nota) já tenha uma. Devolve o id, ou null se não criou. */
export async function criarContaAReceberDaNfse(d: {
  serviceOrderId: string
  customerId: string
  cliente: string
  valor: number
  numeroNfse: string
  chaveAcesso: string | null
  dataEmissao: Date
}): Promise<string | null> {
  if (!(d.valor > 0)) return null
  const jaExiste = await prisma.financeTransaction.count({
    where: {
      type: 'RECEITA', status: { not: 'CANCELADO' },
      OR: [{ serviceOrderId: d.serviceOrderId }, ...(d.chaveAcesso ? [{ notes: { contains: d.chaveAcesso } }] : [])],
    },
  })
  if (jaExiste > 0) return null

  const categoria = await prisma.financeCategory.findFirst({ where: { name: 'Serviços' }, select: { id: true } })
  const conta = await prisma.financeTransaction.create({
    data: montarContaAReceberNfse({ ...d, categoryId: categoria?.id ?? null }),
    select: { id: true },
  })
  return conta.id
}
