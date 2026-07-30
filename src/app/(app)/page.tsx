import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = 'force-dynamic'

export default async function Dashboard() {
  const customerCount = await prisma.customer.count();
  const osCount = await prisma.serviceOrder.count();
  const pendingOs = await prisma.serviceOrder.count({ where: { status: 'BUDGET' } });
  const products = await prisma.product.findMany({ select: { stockQty: true, minStockAlert: true } });
  const productCount = products.length;
  const lowStockCount = products.filter(p => p.stockQty <= p.minStockAlert).length;

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-4">
        <h2>Dashboard</h2>
        <Link href="/os/novo" className="btn btn-primary">Nova Ordem de Serviço</Link>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>

        <div className="card">
          <div className="stat-label">Clientes</div>
          <div className="stat-value accent-blue">{customerCount}</div>
        </div>

        <div className="card">
          <div className="stat-label">Ordens de Serviço</div>
          <div className="stat-value accent-blue">{osCount}</div>
        </div>

        <div className="card">
          <div className="stat-label">Orçamentos Pendentes</div>
          <div className="stat-value accent-orange">{pendingOs}</div>
        </div>

        <div className="card">
          <div className="stat-label">Produtos</div>
          <div className="stat-value accent-blue">{productCount}</div>
        </div>

        <div className="card">
          <div className="stat-label">Estoque Baixo</div>
          <div className={`stat-value ${lowStockCount > 0 ? 'accent-red' : 'accent-green'}`}>{lowStockCount}</div>
        </div>

      </div>
      
      <div className="card" style={{ maxWidth: '420px' }}>
        <h3 className="mb-4">Ações Rápidas</h3>
        <div className="flex" style={{ flexDirection: 'column', gap: '0.6rem' }}>
          <Link href="/os/novo" className="btn btn-primary" style={{ justifyContent: 'flex-start' }}>+ Nova OS</Link>
          <Link href="/clientes/novo" className="btn btn-outline" style={{ justifyContent: 'flex-start' }}>+ Novo Cliente</Link>
          <Link href="/produtos/novo" className="btn btn-outline" style={{ justifyContent: 'flex-start' }}>+ Novo Produto</Link>
          <Link href="/os/rapida" className="btn btn-outline" style={{ justifyContent: 'flex-start' }}>+ Nota de Serviço Avulsa</Link>
          <Link href="/os" className="btn btn-outline" style={{ justifyContent: 'flex-start' }}>Ver todas as OS</Link>
        </div>
      </div>
    </div>
  );
}
