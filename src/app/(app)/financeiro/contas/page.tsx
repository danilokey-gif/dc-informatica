import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { marcarComoPago, marcarComoPendente, deleteTransaction } from "../actions"
import { inicioDoDiaUTC, formatarDataUTC } from "@/lib/dates"

export const dynamic = 'force-dynamic'

function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const statusLabel: Record<string, { texto: string; cor: string }> = {
  PENDENTE: { texto: 'Pendente', cor: '#f59e0b' },
  PAGO: { texto: 'Pago', cor: '#16a34a' },
  CANCELADO: { texto: 'Cancelado', cor: 'var(--text-muted)' },
}

export default async function ContasPage({ searchParams }: { searchParams: Promise<{ tipo?: string; status?: string }> }) {
  const { tipo, status } = await searchParams
  const hoje = inicioDoDiaUTC()

  const transacoes = await prisma.financeTransaction.findMany({
    where: {
      ...(tipo ? { type: tipo } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: { dueDate: 'desc' },
    include: { category: true, customer: true, supplier: true }
  })

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-4">
        <h2>Contas a Pagar/Receber</h2>
        <div className="flex gap-4">
          <Link href="/financeiro" className="text-muted">Voltar</Link>
          <Link href="/financeiro/contas/novo" className="btn btn-primary">Novo Lançamento</Link>
        </div>
      </div>

      <div className="flex gap-4 mb-4">
        <Link href="/financeiro/contas" className={`btn ${!tipo && !status ? 'btn-primary' : 'btn-outline'}`}>Todas</Link>
        <Link href="/financeiro/contas?tipo=RECEITA" className={`btn ${tipo === 'RECEITA' ? 'btn-primary' : 'btn-outline'}`}>Receitas</Link>
        <Link href="/financeiro/contas?tipo=DESPESA" className={`btn ${tipo === 'DESPESA' ? 'btn-primary' : 'btn-outline'}`}>Despesas</Link>
        <Link href="/financeiro/contas?status=PENDENTE" className={`btn ${status === 'PENDENTE' ? 'btn-primary' : 'btn-outline'}`}>Pendentes</Link>
        <Link href="/financeiro/contas?status=PAGO" className={`btn ${status === 'PAGO' ? 'btn-primary' : 'btn-outline'}`}>Pagas</Link>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Descrição</th>
              <th>Tipo</th>
              <th>Categoria</th>
              <th>Vencimento</th>
              <th>Valor</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {transacoes.length === 0 && (
              <tr><td colSpan={7} className="text-center text-muted">Nenhum lançamento encontrado.</td></tr>
            )}
            {transacoes.map(t => {
              const atrasada = t.status === 'PENDENTE' && new Date(t.dueDate) < hoje
              const marcarPagoAction = marcarComoPago.bind(null, t.id)
              const marcarPendenteAction = marcarComoPendente.bind(null, t.id)
              const excluirAction = deleteTransaction.bind(null, t.id)
              return (
                <tr key={t.id}>
                  <td>
                    <Link href={`/financeiro/contas/${t.id}`} className="text-primary">{t.description}</Link>
                    <div className="text-muted" style={{ fontSize: '0.75rem' }}>{t.customer?.name || t.supplier?.name || ''}</div>
                  </td>
                  <td style={{ color: t.type === 'RECEITA' ? '#16a34a' : '#dc2626' }}>{t.type === 'RECEITA' ? 'Receita' : 'Despesa'}</td>
                  <td>{t.category?.name || '-'}</td>
                  <td>{formatarDataUTC(t.dueDate)}{atrasada && <span style={{ color: '#dc2626', fontWeight: 600, marginLeft: '0.5rem', fontSize: '0.75rem' }}>ATRASADA</span>}</td>
                  <td>{formatarMoeda(t.amount)}</td>
                  <td><span style={{ color: statusLabel[t.status].cor, fontWeight: 500 }}>{statusLabel[t.status].texto}</span></td>
                  <td>
                    <div className="flex gap-4">
                      {t.status === 'PENDENTE' ? (
                        <form action={marcarPagoAction}>
                          <button type="submit" className="text-primary" style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>Marcar Pago</button>
                        </form>
                      ) : (
                        <form action={marcarPendenteAction}>
                          <button type="submit" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 500 }}>Reabrir</button>
                        </form>
                      )}
                      <form action={excluirAction}>
                        <button type="submit" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 500 }}>Excluir</button>
                      </form>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
