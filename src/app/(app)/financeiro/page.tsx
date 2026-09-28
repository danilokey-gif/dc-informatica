import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { inicioDoDiaUTC, formatarDataUTC } from "@/lib/dates"

export const dynamic = 'force-dynamic'

function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default async function FinanceiroPage({ searchParams }: { searchParams: Promise<{ mes?: string, ano?: string }> }) {
  const params = await searchParams
  const hoje = inicioDoDiaUTC()

  const hojeDate = new Date()
  const mesSel = params.mes ? parseInt(params.mes) : (hojeDate.getMonth() + 1)
  const anoSel = params.ano ? parseInt(params.ano) : hojeDate.getFullYear()

  const mesStr = mesSel.toString().padStart(2, '0')
  const inicioDoMes = new Date(`${anoSel}-${mesStr}-01T00:00:00.000Z`)
  
  let proximoMes = mesSel + 1
  let proximoAno = anoSel
  if (proximoMes > 12) {
    proximoMes = 1
    proximoAno++
  }
  const inicioProximoMes = new Date(`${proximoAno}-${proximoMes.toString().padStart(2, '0')}-01T00:00:00.000Z`)

  let prevMes = mesSel - 1
  let prevAno = anoSel
  if (prevMes < 1) { prevMes = 12; prevAno-- }

  const nomeMes = new Date(`${anoSel}-${mesStr}-02T00:00:00.000Z`).toLocaleString('pt-BR', { month: 'long' })

  const [receitasPagas, despesasPagas, aReceber, aPagar, atrasadas, proximasVencer] = await Promise.all([
    prisma.financeTransaction.aggregate({ _sum: { amount: true }, where: { type: 'RECEITA', status: 'PAGO', dueDate: { gte: inicioDoMes, lt: inicioProximoMes } } }),
    prisma.financeTransaction.aggregate({ _sum: { amount: true }, where: { type: 'DESPESA', status: 'PAGO', dueDate: { gte: inicioDoMes, lt: inicioProximoMes } } }),
    prisma.financeTransaction.aggregate({ _sum: { amount: true }, where: { type: 'RECEITA', status: 'PENDENTE', dueDate: { gte: inicioDoMes, lt: inicioProximoMes } } }),
    prisma.financeTransaction.aggregate({ _sum: { amount: true }, where: { type: 'DESPESA', status: 'PENDENTE', dueDate: { gte: inicioDoMes, lt: inicioProximoMes } } }),
    prisma.financeTransaction.findMany({
      where: { status: 'PENDENTE', dueDate: { lt: hoje } },
      orderBy: { dueDate: 'asc' },
      include: { customer: true, supplier: true }
    }),
    prisma.financeTransaction.findMany({
      where: { status: 'PENDENTE', dueDate: { gte: hoje, lt: inicioProximoMes } },
      orderBy: { dueDate: 'asc' },
      take: 8,
      include: { customer: true, supplier: true }
    }),
  ])

  const saldo = (receitasPagas._sum.amount || 0) - (despesasPagas._sum.amount || 0)
  const totalAReceber = aReceber._sum.amount || 0
  const totalAPagar = aPagar._sum.amount || 0
  const totalAtrasado = atrasadas.reduce((acc, t) => acc + t.amount, 0)

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-4" style={{ flexWrap: 'wrap', gap: '1rem' }}>
        <div className="flex items-center gap-4">
          <h2 style={{ margin: 0 }}>Financeiro</h2>
          <div className="flex items-center gap-2 bg-gray-100 rounded-md px-2 py-1" style={{ backgroundColor: 'var(--surface)' }}>
            <Link href={`/financeiro?mes=${prevMes}&ano=${prevAno}`} className="btn btn-outline" style={{ padding: '0.25rem 0.5rem', fontSize: '1rem' }}>&lsaquo;</Link>
            <span style={{ minWidth: '120px', textAlign: 'center', textTransform: 'capitalize', fontWeight: 500 }}>
              {nomeMes} {anoSel}
            </span>
            <Link href={`/financeiro?mes=${proximoMes}&ano=${proximoAno}`} className="btn btn-outline" style={{ padding: '0.25rem 0.5rem', fontSize: '1rem' }}>&rsaquo;</Link>
          </div>
        </div>
        <div className="flex gap-4" style={{ flexWrap: 'wrap' }}>
          <Link href="/financeiro/categorias" className="btn btn-outline">Categorias</Link>
          <Link href="/financeiro/contas" className="btn btn-outline">Ver Todas as Contas</Link>
          <Link href="/financeiro/importar" className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            📥 Importar Extrato (OFX)
          </Link>
          <Link href="/financeiro/contas/novo" className="btn btn-primary">+ Adicionar Transação</Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="card text-center" style={{ borderTop: '4px solid var(--primary)' }}>
          <h3 className="text-muted" style={{ fontSize: '1rem', fontWeight: 500 }}>Saldo (Realizado)</h3>
          <p style={{ fontSize: '1.75rem', fontWeight: 'bold', color: saldo >= 0 ? '#16a34a' : '#dc2626' }}>{formatarMoeda(saldo)}</p>
        </div>

        <div className="card text-center" style={{ borderTop: '4px solid #16a34a' }}>
          <h3 className="text-muted" style={{ fontSize: '1rem', fontWeight: 500 }}>A Receber</h3>
          <p style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--text-main)' }}>{formatarMoeda(totalAReceber)}</p>
        </div>

        <div className="card text-center" style={{ borderTop: '4px solid #f59e0b' }}>
          <h3 className="text-muted" style={{ fontSize: '1rem', fontWeight: 500 }}>A Pagar</h3>
          <p style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--text-main)' }}>{formatarMoeda(totalAPagar)}</p>
        </div>

        <div className="card text-center" style={{ borderTop: '4px solid #dc2626' }}>
          <h3 className="text-muted" style={{ fontSize: '1rem', fontWeight: 500 }}>Atrasado</h3>
          <p style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--text-main)' }}>{formatarMoeda(totalAtrasado)}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
        <div className="card">
          <h3 className="mb-4">Vencidas</h3>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr><th>Descrição</th><th>Venc.</th><th>Valor</th></tr>
              </thead>
              <tbody>
                {atrasadas.length === 0 && (
                  <tr><td colSpan={3} className="text-center text-muted">Nenhuma conta vencida.</td></tr>
                )}
                {atrasadas.map(t => (
                  <tr key={t.id}>
                    <td>
                      <Link href={`/financeiro/contas/${t.id}`} className="text-primary">{t.description}</Link>
                      <div className="text-muted" style={{ fontSize: '0.75rem' }}>{t.customer?.name || t.supplier?.name || ''}</div>
                    </td>
                    <td>{formatarDataUTC(t.dueDate)}</td>
                    <td style={{ color: t.type === 'RECEITA' ? '#16a34a' : '#dc2626' }}>{formatarMoeda(t.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h3 className="mb-4">Próximos Vencimentos</h3>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr><th>Descrição</th><th>Venc.</th><th>Valor</th></tr>
              </thead>
              <tbody>
                {proximasVencer.length === 0 && (
                  <tr><td colSpan={3} className="text-center text-muted">Nada por vir.</td></tr>
                )}
                {proximasVencer.map(t => (
                  <tr key={t.id}>
                    <td>
                      <Link href={`/financeiro/contas/${t.id}`} className="text-primary">{t.description}</Link>
                      <div className="text-muted" style={{ fontSize: '0.75rem' }}>{t.customer?.name || t.supplier?.name || ''}</div>
                    </td>
                    <td>{formatarDataUTC(t.dueDate)}</td>
                    <td style={{ color: t.type === 'RECEITA' ? '#16a34a' : '#dc2626' }}>{formatarMoeda(t.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
