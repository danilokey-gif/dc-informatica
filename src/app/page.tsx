import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function Dashboard() {
  const customerCount = await prisma.customer.count();
  const osCount = await prisma.serviceOrder.count();
  const pendingOs = await prisma.serviceOrder.count({ where: { status: 'BUDGET' } });
  
  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-4">
        <h2>Dashboard</h2>
        <Link href="/os/novo" className="btn btn-primary">Nova Ordem de Serviço</Link>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        
        <div className="card text-center" style={{ borderTop: '4px solid var(--primary)' }}>
          <h3 className="text-muted" style={{ fontSize: '1rem', fontWeight: 500 }}>Total de Clientes</h3>
          <p style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--text-main)' }}>{customerCount}</p>
        </div>

        <div className="card text-center" style={{ borderTop: '4px solid var(--primary)' }}>
          <h3 className="text-muted" style={{ fontSize: '1rem', fontWeight: 500 }}>Ordens de Serviço</h3>
          <p style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--text-main)' }}>{osCount}</p>
        </div>

        <div className="card text-center" style={{ borderTop: '4px solid #f59e0b' }}>
          <h3 className="text-muted" style={{ fontSize: '1rem', fontWeight: 500 }}>Orçamentos Pendentes</h3>
          <p style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--text-main)' }}>{pendingOs}</p>
        </div>

      </div>
      
      <div className="card">
        <h3 className="mb-4">Ações Rápidas</h3>
        <div className="flex gap-4">
          <Link href="/clientes/novo" className="btn btn-outline">Cadastrar Cliente</Link>
          <Link href="/clientes" className="btn btn-outline">Buscar Clientes</Link>
          <Link href="/os" className="btn btn-outline">Ver todas as OS</Link>
        </div>
      </div>
    </div>
  );
}
