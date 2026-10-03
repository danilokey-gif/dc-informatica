import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = 'force-dynamic'

// Mesma janela da tela "Emitir Nota": pendências antigas provavelmente já foram emitidas fora do sistema.
const JANELA_NOTAS_DIAS = 120

export default async function Dashboard() {
  const desde = new Date(Date.now() - JANELA_NOTAS_DIAS * 864e5)
  const [customerCount, osAbertas, osAguardando, products, osSemNota, vendasSemNota] = await Promise.all([
    prisma.customer.count(),
    prisma.serviceOrder.count({ where: { status: { in: ['BUDGET', 'IN_PROGRESS'] } } }),
    prisma.serviceOrder.count({ where: { status: 'BUDGET' } }),
    prisma.product.findMany({ select: { stockQty: true, minStockAlert: true } }),
    prisma.serviceOrder.count({ where: { status: { in: ['COMPLETED', 'DELIVERED'] }, price: { gt: 0 }, updatedAt: { gte: desde }, nfseEmissoes: { none: { status: 'AUTORIZADA' } } } }),
    prisma.sale.count({ where: { createdAt: { gte: desde }, invoiceNumber: null, nfeEmissoes: { none: { status: 'AUTORIZADA' } } } }),
  ])
  const lowStockCount = products.filter(p => p.stockQty <= p.minStockAlert).length
  const notasPendentes = osSemNota + vendasSemNota

  // As quatro coisas mais feitas no dia a dia, num clique.
  const acoes = [
    { href: '/os/novo', icone: '🛠️', titulo: 'Nova OS', texto: 'Abrir ordem de serviço' },
    { href: '/vendas/novo', icone: '🛒', titulo: 'Nova Venda', texto: 'Vender produto' },
    { href: '/notas-fiscais/emitir', icone: '🧾', titulo: 'Emitir Nota', texto: 'Serviço ou produto' },
    { href: '/clientes/novo', icone: '👤', titulo: 'Novo Cliente', texto: 'Cadastrar cliente' },
  ]

  const indicadores = [
    { href: '/os', rotulo: 'OS em aberto', valor: osAbertas, cor: 'accent-blue' },
    { href: '/os', rotulo: 'OS aguardando aprovação', valor: osAguardando, cor: osAguardando > 0 ? 'accent-orange' : 'accent-green' },
    { href: '/notas-fiscais/emitir', rotulo: 'Notas a emitir', valor: notasPendentes, cor: notasPendentes > 0 ? 'accent-orange' : 'accent-green' },
    { href: '/produtos', rotulo: 'Produtos com estoque baixo', valor: lowStockCount, cor: lowStockCount > 0 ? 'accent-red' : 'accent-green' },
    { href: '/clientes', rotulo: 'Clientes', valor: customerCount, cor: 'accent-blue' },
  ]

  return (
    <div className="animate-fade-in">
      <h2 className="mb-4">Início</h2>

      <div className="acoes-rapidas">
        {acoes.map(a => (
          <Link key={a.href} href={a.href} className="acao-rapida">
            <span className="acao-rapida-icone" aria-hidden>{a.icone}</span>
            <span>
              <span className="acao-rapida-titulo">{a.titulo}</span>
              <span className="acao-rapida-texto">{a.texto}</span>
            </span>
          </Link>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', marginTop: '2rem' }}>
        {indicadores.map(i => (
          <Link key={i.rotulo} href={i.href} className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="stat-label">{i.rotulo}</div>
            <div className={`stat-value ${i.cor}`}>{i.valor}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
