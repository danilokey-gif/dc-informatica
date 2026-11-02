/**
 * Separa as receitas em "com nota" e "sem nota" (faturamento) e "outros" (reembolsos e créditos que
 * não são venda nem serviço). Com nota = ligada a uma nota autorizada: venda com NF-e (ou nº de nota
 * informado), OS com NFS-e, ou chave/número da NFS-e anotado no lançamento (recebimentos do extrato
 * conciliados com a nota).
 */
export const SELECT_NOTA = {
  description: true, notes: true, paymentMethod: true,
  category: { select: { name: true } },
  sale: { select: { invoiceNumber: true, nfeEmissoes: { where: { status: 'AUTORIZADA' }, select: { id: true } } } },
  serviceOrder: { select: { nfseEmissoes: { where: { status: 'AUTORIZADA' }, select: { id: true } } } },
} as const

type Receita = {
  description: string
  notes: string | null
  paymentMethod: string | null
  category: { name: string } | null
  sale: { invoiceNumber: string | null; nfeEmissoes: { id: string }[] } | null
  serviceOrder: { nfseEmissoes: { id: string }[] } | null
}

export type Origem = 'COM_NOTA' | 'SEM_NOTA' | 'OUTROS'

export function origemReceita(r: Receita): Origem {
  if (r.sale && (r.sale.invoiceNumber || r.sale.nfeEmissoes.length)) return 'COM_NOTA'
  if (r.serviceOrder?.nfseEmissoes.length) return 'COM_NOTA'
  if (/\d{50}|NFS-e nº|NFS-e \d/.test(`${r.description} ${r.notes || ''}`) || r.paymentMethod === 'NFS-e') return 'COM_NOTA'
  if (r.category?.name === 'Recebimentos diversos') return 'OUTROS'
  return 'SEM_NOTA'
}
