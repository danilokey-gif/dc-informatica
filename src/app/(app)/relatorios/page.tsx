import { prisma } from "@/lib/prisma"

export const dynamic = 'force-dynamic'

const statusLabels: Record<string, string> = {
  BUDGET: 'Orçamento Pendente',
  APPROVED: 'Orçamento Aprovado',
  IN_PROGRESS: 'Em Andamento',
  COMPLETED: 'Concluída',
  DELIVERED: 'Entregue',
}

function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default async function RelatoriosPage() {
  const [vendasAgg, osAgg, saleItems, osPorStatus] = await Promise.all([
    prisma.sale.aggregate({ _sum: { total: true }, _count: true }),
    prisma.serviceOrder.aggregate({
      _sum: { price: true },
      _count: true,
      where: { status: { in: ['COMPLETED', 'DELIVERED'] } }
    }),
    prisma.saleItem.findMany({
      include: { product: { select: { name: true, costPrice: true } } }
    }),
    prisma.serviceOrder.groupBy({
      by: ['status'],
      _count: true
    })
  ])

  const faturamentoVendas = vendasAgg._sum.total || 0
  const faturamentoOS = osAgg._sum.price || 0
  const faturamentoTotal = faturamentoVendas + faturamentoOS

  const lucroTotal = saleItems.reduce((acc, item) => acc + (item.unitPrice - item.product.costPrice) * item.quantity, 0)

  const produtosVendidosMap = new Map<string, { nome: string; quantidade: number; total: number }>()
  for (const item of saleItems) {
    const atual = produtosVendidosMap.get(item.productId) || { nome: item.product.name, quantidade: 0, total: 0 }
    atual.quantidade += item.quantity
    atual.total += item.unitPrice * item.quantity
    produtosVendidosMap.set(item.productId, atual)
  }
  const produtosMaisVendidos = Array.from(produtosVendidosMap.values())
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, 5)

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-4">
        <h2>Relatórios</h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="card text-center" style={{ borderTop: '4px solid var(--primary)' }}>
          <h3 className="text-muted" style={{ fontSize: '1rem', fontWeight: 500 }}>Faturamento Total</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--text-main)' }}>{formatarMoeda(faturamentoTotal)}</p>
          <p className="text-muted" style={{ fontSize: '0.8rem' }}>Vendas: {formatarMoeda(faturamentoVendas)} · OS: {formatarMoeda(faturamentoOS)}</p>
        </div>

        <div className="card text-center" style={{ borderTop: '4px solid #16a34a' }}>
          <h3 className="text-muted" style={{ fontSize: '1rem', fontWeight: 500 }}>Lucro Estimado (Produtos)</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--text-main)' }}>{formatarMoeda(lucroTotal)}</p>
          <p className="text-muted" style={{ fontSize: '0.8rem' }}>Venda - Custo, por item vendido</p>
        </div>

        <div className="card text-center" style={{ borderTop: '4px solid var(--primary)' }}>
          <h3 className="text-muted" style={{ fontSize: '1rem', fontWeight: 500 }}>Total de Vendas</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--text-main)' }}>{vendasAgg._count}</p>
        </div>

        <div className="card text-center" style={{ borderTop: '4px solid #f59e0b' }}>
          <h3 className="text-muted" style={{ fontSize: '1rem', fontWeight: 500 }}>OS Concluídas/Entregues</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--text-main)' }}>{osAgg._count}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
        <div className="card">
          <h3 className="mb-4">Produtos Mais Vendidos</h3>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Qtd. Vendida</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {produtosMaisVendidos.length === 0 && (
                  <tr>
                    <td colSpan={3} className="text-center text-muted">Nenhuma venda registrada ainda.</td>
                  </tr>
                )}
                {produtosMaisVendidos.map(produto => (
                  <tr key={produto.nome}>
                    <td>{produto.nome}</td>
                    <td>{produto.quantidade}</td>
                    <td>{formatarMoeda(produto.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h3 className="mb-4">Ordens de Serviço por Status</h3>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Quantidade</th>
                </tr>
              </thead>
              <tbody>
                {osPorStatus.length === 0 && (
                  <tr>
                    <td colSpan={2} className="text-center text-muted">Nenhuma OS cadastrada ainda.</td>
                  </tr>
                )}
                {osPorStatus.map(grupo => (
                  <tr key={grupo.status}>
                    <td>{statusLabels[grupo.status] || grupo.status}</td>
                    <td>{grupo._count}</td>
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
