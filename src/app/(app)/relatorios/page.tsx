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

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

export default async function RelatoriosPage({ searchParams }: { searchParams: Promise<{ ano?: string }> }) {
  const { ano: anoParam } = await searchParams
  const anoAtual = new Date().getFullYear()
  const ano = anoParam && /^\d{4}$/.test(anoParam) ? parseInt(anoParam, 10) : anoAtual

  const [vendasAgg, osAgg, saleItems, osPorStatus, nfseEmissoes, nfeEmissoes] = await Promise.all([
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
    }),
    // Só notas de serviço AUTORIZADAS entram no relatório de faturamento fiscal —
    // OS sem NFS-e emitida não conta, mesmo que já concluída/paga.
    prisma.nfseEmissao.findMany({
      where: { status: 'AUTORIZADA' },
      include: { serviceOrder: { select: { price: true, createdAt: true } } },
    }),
    prisma.nfeEmissao.findMany({
      where: { status: 'AUTORIZADA' },
      include: { sale: { select: { total: true, createdAt: true } } },
    }),
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

  // Relatório mensal de valores faturados em nota fiscal (NFS-e + NF-e), só notas AUTORIZADAS.
  // valorTotal/dataEmissao só vêm preenchidos direto no registro pras notas importadas do
  // governo; pras emitidas pelo próprio sistema, o valor/data vêm da OS/Venda vinculada.
  const nfsePorMes = Array(12).fill(0)
  const nfePorMes = Array(12).fill(0)

  for (const e of nfseEmissoes) {
    const data = e.dataEmissao || e.serviceOrder?.createdAt
    const valor = e.valorTotal ?? e.serviceOrder?.price ?? 0
    if (!data || data.getFullYear() !== ano) continue
    nfsePorMes[data.getMonth()] += valor
  }

  for (const e of nfeEmissoes) {
    const data = e.dataEmissao || e.sale?.createdAt
    const valor = e.valorTotal ?? e.sale?.total ?? 0
    if (!data || data.getFullYear() !== ano) continue
    nfePorMes[data.getMonth()] += valor
  }

  const totalNfseAno = nfsePorMes.reduce((a, b) => a + b, 0)
  const totalNfeAno = nfePorMes.reduce((a, b) => a + b, 0)
  const totalGeralAno = totalNfseAno + totalNfeAno

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

      <div className="card" style={{ marginBottom: '2rem' }}>
        <div className="flex justify-between items-center mb-4" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
          <h3 style={{ margin: 0 }}>📅 Relatório Mensal de Notas Fiscais Emitidas</h3>
          <form method="get" className="flex gap-4" style={{ alignItems: 'center' }}>
            <label className="input-label" htmlFor="ano" style={{ marginBottom: 0 }}>Ano</label>
            <input type="number" id="ano" name="ano" className="input-field" defaultValue={ano} min={2020} max={anoAtual + 1} style={{ width: '100px', padding: '0.35rem 0.6rem' }} />
            <button type="submit" className="btn btn-outline" style={{ padding: '0.35rem 0.75rem' }}>Ver</button>
          </form>
        </div>
        <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
          Considera apenas o valor de notas fiscais efetivamente <strong>emitidas e autorizadas</strong> (NFS-e de serviço + NF-e de produto) — orçamentos, OS ou vendas sem nota emitida não entram nesta soma.
        </p>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Mês</th>
                <th>NFS-e (Serviço)</th>
                <th>NF-e (Produto)</th>
                <th>Total do Mês</th>
              </tr>
            </thead>
            <tbody>
              {MESES.map((nome, i) => (
                <tr key={nome}>
                  <td>{nome}</td>
                  <td>{formatarMoeda(nfsePorMes[i])}</td>
                  <td>{formatarMoeda(nfePorMes[i])}</td>
                  <td style={{ fontWeight: 600 }}>{formatarMoeda(nfsePorMes[i] + nfePorMes[i])}</td>
                </tr>
              ))}
              <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 700 }}>
                <td>Total do Ano {ano}</td>
                <td>{formatarMoeda(totalNfseAno)}</td>
                <td>{formatarMoeda(totalNfeAno)}</td>
                <td style={{ color: 'var(--accent-green)' }}>{formatarMoeda(totalGeralAno)}</td>
              </tr>
            </tbody>
          </table>
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
