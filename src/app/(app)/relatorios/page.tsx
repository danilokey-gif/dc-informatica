import { prisma } from "@/lib/prisma"
import TableRowDoubleClick from "./TableRowDoubleClick"

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

  const [vendasAgg, osAgg, saleItems, osPorStatus, nfseEmissoes, nfeEmissoes, financeTransactions] = await Promise.all([
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
    // Notas de homologação são testes, sem valor fiscal: não são faturamento.
    prisma.nfseEmissao.findMany({
      where: { status: 'AUTORIZADA', ambiente: 'producao' },
      include: { serviceOrder: { select: { price: true, createdAt: true } } },
    }),
    prisma.nfeEmissao.findMany({
      where: { status: 'AUTORIZADA', ambiente: 'producao' },
      include: { sale: { select: { total: true, createdAt: true } } },
    }),
    prisma.financeTransaction.findMany({
      where: {
        status: 'PAGO',
        dueDate: {
          gte: new Date(`${ano}-01-01T00:00:00.000Z`),
          lt: new Date(`${ano + 1}-01-01T00:00:00.000Z`)
        }
      }
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

  const receitasMes = Array(12).fill(0)
  const despesasMes = Array(12).fill(0)
  for (const t of financeTransactions) {
    if (t.dueDate.getFullYear() === ano) {
      if (t.type === 'RECEITA') receitasMes[t.dueDate.getMonth()] += t.amount
      else despesasMes[t.dueDate.getMonth()] += t.amount
    }
  }
  const totalReceitasAno = receitasMes.reduce((a, b) => a + b, 0)
  const totalDespesasAno = despesasMes.reduce((a, b) => a + b, 0)
  const saldoAno = totalReceitasAno - totalDespesasAno

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
          <h3 style={{ margin: 0 }}>📊 Balancete de Conciliação Mensal (Notas vs. Extrato)</h3>
          <form method="get" className="flex gap-4" style={{ alignItems: 'center' }}>
            <label className="input-label" htmlFor="ano" style={{ marginBottom: 0 }}>Ano</label>
            <input type="number" id="ano" name="ano" className="input-field" defaultValue={ano} min={2020} max={anoAtual + 1} style={{ width: '100px', padding: '0.35rem 0.6rem' }} />
            <button type="submit" className="btn btn-outline" style={{ padding: '0.35rem 0.75rem' }}>Ver</button>
          </form>
        </div>
        <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
          Cruza o total de <strong>Notas Emitidas</strong> (NF-e + NFS-e) com o que realmente entrou ou saiu do banco (<strong>Receitas e Despesas Pagas</strong>), para facilitar a identificação de furos e pendências.
        </p>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Mês</th>
                <th>Notas Fiscais (Emitido)</th>
                <th>Receitas no Banco (Entradas)</th>
                <th>Despesas (Saídas)</th>
                <th>Diferença Fiscal x Banco</th>
              </tr>
            </thead>
            <tbody>
              {MESES.map((nome, i) => {
                const totalNotas = nfsePorMes[i] + nfePorMes[i];
                const diferenca = receitasMes[i] - totalNotas;
                const mesNum = i + 1;
                return (
                  <TableRowDoubleClick key={nome} url={`/financeiro?mes=${mesNum}&ano=${ano}`}>
                    <td>
                      <div className="flex items-center gap-2">
                        {nome}
                        <a href={`/relatorios/mensal?mes=${mesNum}&ano=${ano}`} className="text-primary hover:text-primary-hover" title="Ver Relatório Mensal">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                        </a>
                      </div>
                    </td>
                    <td style={{ color: totalNotas > 0 ? '#16a34a' : 'inherit' }}>{formatarMoeda(totalNotas)}</td>
                    <td style={{ color: receitasMes[i] > 0 ? '#16a34a' : 'inherit' }}>{formatarMoeda(receitasMes[i])}</td>
                    <td style={{ color: despesasMes[i] > 0 ? '#dc2626' : 'inherit' }}>{formatarMoeda(despesasMes[i])}</td>
                    <td style={{ fontWeight: 600, color: diferenca === 0 ? 'inherit' : (diferenca > 0 ? '#16a34a' : '#dc2626') }}>
                      {formatarMoeda(diferenca)}
                    </td>
                  </TableRowDoubleClick>
                )
              })}
              <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 700 }}>
                <td>Total do Ano {ano}</td>
                <td style={{ color: '#16a34a' }}>{formatarMoeda(totalGeralAno)}</td>
                <td style={{ color: '#16a34a' }}>{formatarMoeda(totalReceitasAno)}</td>
                <td style={{ color: '#dc2626' }}>{formatarMoeda(totalDespesasAno)}</td>
                <td style={{ color: (totalReceitasAno - totalGeralAno) >= 0 ? '#16a34a' : '#dc2626' }}>{formatarMoeda(totalReceitasAno - totalGeralAno)}</td>
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
