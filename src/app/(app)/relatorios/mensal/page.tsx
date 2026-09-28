import { prisma } from "@/lib/prisma"
import Link from "next/link"
import PrintButton from "./PrintButton"

export const dynamic = 'force-dynamic'

function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(date: Date) {
  return date.toLocaleDateString('pt-BR')
}

export default async function RelatorioMensalPage({ searchParams }: { searchParams: Promise<{ mes?: string; ano?: string }> }) {
  const params = await searchParams
  const mesAtual = new Date().getMonth() + 1
  const anoAtual = new Date().getFullYear()

  const mes = params.mes ? parseInt(params.mes, 10) : mesAtual
  const ano = params.ano ? parseInt(params.ano, 10) : anoAtual

  const dataInicio = new Date(ano, mes - 1, 1)
  const dataFim = new Date(ano, mes, 0, 23, 59, 59, 999)

  const transactions = await prisma.financeTransaction.findMany({
    where: {
      status: 'PAGO',
      paidDate: {
        gte: dataInicio,
        lte: dataFim,
      }
    },
    orderBy: {
      paidDate: 'asc'
    },
    include: {
      category: true,
      supplier: true,
      customer: true
    }
  })

  const entradas = transactions.filter(t => t.type === 'RECEITA')
  const saidas = transactions.filter(t => t.type === 'DESPESA')

  const totalEntradas = entradas.reduce((acc, t) => acc + t.amount, 0)
  const totalSaidas = saidas.reduce((acc, t) => acc + t.amount, 0)
  const saldo = totalEntradas - totalSaidas

  const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
  const mesNome = MESES[mes - 1]

  return (
    <div className="animate-fade-in relatorio-print">
      <div className="flex justify-between items-center mb-6 no-print">
        <div className="flex items-center gap-4">
          <Link href={`/relatorios?ano=${ano}`} className="btn btn-outline">
            Voltar
          </Link>
          <h2>Relatório de Caixa - {mesNome} {ano}</h2>
        </div>
        <PrintButton />
      </div>

      {/* Header visível apenas na impressão */}
      <div className="print-only hidden mb-6 text-center">
        <h2>Relatório Mensal de Caixa</h2>
        <p className="text-muted">Período: {mesNome} de {ano}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="card text-center" style={{ borderTop: '4px solid #16a34a' }}>
          <h3 className="text-muted" style={{ fontSize: '1rem', fontWeight: 500 }}>Total de Entradas</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#16a34a' }}>{formatarMoeda(totalEntradas)}</p>
          <p className="text-muted" style={{ fontSize: '0.8rem' }}>Receitas pagas no mês</p>
        </div>

        <div className="card text-center" style={{ borderTop: '4px solid #dc2626' }}>
          <h3 className="text-muted" style={{ fontSize: '1rem', fontWeight: 500 }}>Total de Saídas</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#dc2626' }}>{formatarMoeda(totalSaidas)}</p>
          <p className="text-muted" style={{ fontSize: '0.8rem' }}>Despesas pagas no mês</p>
        </div>

        <div className="card text-center" style={{ borderTop: `4px solid ${saldo >= 0 ? '#16a34a' : '#dc2626'}` }}>
          <h3 className="text-muted" style={{ fontSize: '1rem', fontWeight: 500 }}>Resultado Financeiro</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', color: saldo >= 0 ? '#16a34a' : '#dc2626' }}>{formatarMoeda(saldo)}</p>
          <p className="text-muted" style={{ fontSize: '0.8rem' }}>Lucro / Prejuízo do mês</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <h3 className="mb-4">⬇️ Entradas (Receitas Pagas)</h3>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Data Pgto.</th>
                <th>Descrição</th>
                <th>Categoria</th>
                <th>Cliente</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              {entradas.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center text-muted">Nenhuma entrada registrada.</td>
                </tr>
              ) : (
                entradas.map(t => (
                  <tr key={t.id}>
                    <td>{t.paidDate ? formatDate(t.paidDate) : '-'}</td>
                    <td>{t.description}</td>
                    <td>{t.category?.name || '-'}</td>
                    <td>{t.customer?.name || '-'}</td>
                    <td style={{ color: '#16a34a', fontWeight: 500 }}>{formatarMoeda(t.amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3 className="mb-4">⬆️ Saídas (Despesas Pagas)</h3>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Data Pgto.</th>
                <th>Descrição</th>
                <th>Categoria</th>
                <th>Fornecedor</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              {saidas.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center text-muted">Nenhuma saída registrada.</td>
                </tr>
              ) : (
                saidas.map(t => (
                  <tr key={t.id}>
                    <td>{t.paidDate ? formatDate(t.paidDate) : '-'}</td>
                    <td>{t.description}</td>
                    <td>{t.category?.name || '-'}</td>
                    <td>{t.supplier?.name || '-'}</td>
                    <td style={{ color: '#dc2626', fontWeight: 500 }}>{formatarMoeda(t.amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
