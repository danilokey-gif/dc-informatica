import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { formatarDataUTC } from "@/lib/dates"

const BRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const data = (d: Date) => d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })

const STATUS_OS: Record<string, { nome: string; cor: string }> = {
  BUDGET: { nome: 'Orçamento', cor: '#f59e0b' },
  APPROVED: { nome: 'Aprovado', cor: '#3b82f6' },
  IN_PROGRESS: { nome: 'Em andamento', cor: '#8b5cf6' },
  COMPLETED: { nome: 'Concluído', cor: '#10b981' },
  DELIVERED: { nome: 'Entregue', cor: '#6b7280' },
}
const STATUS_ORCAMENTO: Record<string, { nome: string; cor: string }> = {
  PENDING: { nome: 'Pendente', cor: '#f59e0b' },
  APPROVED: { nome: 'Aprovado', cor: '#10b981' },
  REJECTED: { nome: 'Recusado', cor: '#6b7280' },
}

interface Linha {
  data: Date
  tipo: 'OS' | 'Venda' | 'Orçamento'
  numero: string
  href: string
  titulo: string
  detalhe: string
  valor: number | null
  status: { nome: string; cor: string }
  nota: string | null
}

/**
 * Tudo o que já foi feito para o cliente, do mais recente para o mais antigo: ordens de serviço
 * (equipamento, defeito, laudo), vendas (produtos), orçamentos, notas fiscais e o que está em aberto
 * no financeiro.
 */
export default async function HistoricoCliente({ clienteId }: { clienteId: string }) {
  const [ordens, vendas, orcamentos, emAberto] = await Promise.all([
    prisma.serviceOrder.findMany({
      where: { customerId: clienteId },
      include: { nfseEmissoes: { where: { status: 'AUTORIZADA' }, select: { numeroDps: true }, take: 1 }, technician: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.sale.findMany({
      where: { customerId: clienteId },
      include: { items: { include: { product: { select: { name: true } } } }, nfeEmissoes: { where: { status: 'AUTORIZADA' }, select: { numero: true }, take: 1 } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.quote.findMany({
      where: { customerId: clienteId },
      include: { items: { include: { product: { select: { name: true } } } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.financeTransaction.findMany({
      where: { customerId: clienteId, type: 'RECEITA', status: 'PENDENTE' },
      orderBy: { dueDate: 'asc' },
    }),
  ])

  const linhas: Linha[] = [
    ...ordens.map(o => ({
      data: o.createdAt,
      tipo: 'OS' as const,
      numero: o.id.slice(-6).toUpperCase(),
      href: `/os/${o.id}/imprimir`,
      titulo: o.device || 'Serviço',
      detalhe: [o.issue, o.technicalReport && `Laudo: ${o.technicalReport}`, o.technician?.name && `Técnico: ${o.technician.name}`].filter(Boolean).join(' · '),
      valor: o.price,
      status: STATUS_OS[o.status] ?? { nome: o.status, cor: '#6b7280' },
      nota: o.nfseEmissoes[0] ? `NFS-e nº ${o.nfseEmissoes[0].numeroDps}` : null,
    })),
    ...vendas.map(v => ({
      data: v.createdAt,
      tipo: 'Venda' as const,
      numero: v.id.slice(-6).toUpperCase(),
      href: `/vendas/${v.id}/imprimir`,
      titulo: v.items.map(i => `${i.quantity}x ${i.product.name}`).join('; ') || 'Venda',
      detalhe: v.paymentMethod,
      valor: v.total,
      status: v.status === 'CANCELADA' ? { nome: 'Cancelada', cor: '#dc2626' } : { nome: 'Concluída', cor: '#10b981' },
      nota: v.nfeEmissoes[0] ? `NF-e nº ${v.nfeEmissoes[0].numero}` : v.invoiceNumber ? `Nota ${v.invoiceNumber}` : null,
    })),
    ...orcamentos.map(q => ({
      data: q.createdAt,
      tipo: 'Orçamento' as const,
      numero: q.id.slice(-6).toUpperCase(),
      href: `/orcamentos/${q.id}/imprimir`,
      titulo: q.items.map(i => `${i.quantity}x ${i.name || i.product?.name || 'item'}`).join('; ') || 'Orçamento',
      detalhe: q.notes || '',
      valor: q.total,
      status: STATUS_ORCAMENTO[q.status] ?? { nome: q.status, cor: '#6b7280' },
      nota: null,
    })),
  ].sort((a, b) => b.data.getTime() - a.data.getTime())

  // O que o cliente efetivamente gastou: OS concluídas/entregues e vendas não canceladas.
  const totalGasto = ordens.filter(o => o.status === 'COMPLETED' || o.status === 'DELIVERED').reduce((s, o) => s + (o.price ?? 0), 0)
    + vendas.filter(v => v.status !== 'CANCELADA').reduce((s, v) => s + v.total, 0)
  const totalAberto = emAberto.reduce((s, t) => s + t.amount, 0)

  return (
    <div className="card" style={{ marginTop: '1.5rem' }}>
      <h3 style={{ marginTop: 0 }}>Histórico do cliente</h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', margin: '0.75rem 0 1rem' }}>
        <Resumo rotulo="Atendimentos (OS)" valor={String(ordens.length)} />
        <Resumo rotulo="Compras" valor={String(vendas.filter(v => v.status !== 'CANCELADA').length)} />
        <Resumo rotulo="Total gasto" valor={BRL(totalGasto)} />
        <Resumo rotulo="Em aberto" valor={BRL(totalAberto)} cor={totalAberto > 0 ? 'var(--accent-orange)' : undefined} />
        <Resumo rotulo="Último atendimento" valor={linhas[0] ? data(linhas[0].data) : '—'} />
      </div>

      {emAberto.length > 0 && (
        <div style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
          <strong>A receber:</strong>{' '}
          {emAberto.map((t, i) => (
            <span key={t.id}>
              {i > 0 && ' · '}
              <Link href={`/financeiro/contas/${t.id}`} className="text-primary">{t.description}</Link> — {BRL(t.amount)}, vence {formatarDataUTC(t.dueDate)}
            </span>
          ))}
        </div>
      )}

      {linhas.length === 0 ? (
        <p className="text-muted">Nenhum atendimento registrado para este cliente.</p>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr><th>Data</th><th>Tipo</th><th>Equipamento / produtos e serviço</th><th>Valor</th><th>Situação</th><th>Nota</th></tr>
            </thead>
            <tbody>
              {linhas.map(l => (
                <tr key={`${l.tipo}-${l.numero}`}>
                  <td style={{ whiteSpace: 'nowrap' }}>{data(l.data)}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <Link href={l.href} className="text-primary">{l.tipo} #{l.numero}</Link>
                  </td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{l.titulo}</div>
                    {l.detalhe && <div className="text-muted" style={{ fontSize: '0.78rem' }}>{l.detalhe}</div>}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>{l.valor != null ? BRL(l.valor) : '—'}</td>
                  <td><span style={{ color: l.status.cor, fontWeight: 600, fontSize: '0.8rem' }}>{l.status.nome}</span></td>
                  <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{l.nota ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Resumo({ rotulo, valor, cor }: { rotulo: string; valor: string; cor?: string }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '0.5rem 0.75rem' }}>
      <div className="text-muted" style={{ fontSize: '0.72rem' }}>{rotulo}</div>
      <div style={{ fontWeight: 700, fontSize: '1.05rem', color: cor }}>{valor}</div>
    </div>
  )
}
