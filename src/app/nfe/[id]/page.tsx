import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { notFound } from "next/navigation"
import { cancelInvoice } from "../actions"

export default async function NFEPage({ params }: { params: { id: string } }) {
  const { id } = await params
  
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { customer: true, serviceOrder: true, items: { include: { product: true } } }
  })

  if (!invoice) {
    notFound()
  }

  const cancelAction = cancelInvoice.bind(null, id)

  return (
    <div style={{ backgroundColor: 'white', color: 'black', padding: '2rem', maxWidth: '900px', margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #dc2626', paddingBottom: '1rem', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ color: '#dc2626', margin: 0, fontSize: '2rem' }}>Dc Informática</h1>
          <p style={{ margin: '0.25rem 0 0 0', color: '#4b5563', fontSize: '0.875rem' }}>CNPJ: 12.345.678/0001-90</p>
          <p style={{ margin: 0, color: '#4b5563', fontSize: '0.875rem' }}>Assistência Técnica Especializada</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#111827' }}>NOTA FISCAL ELETRÔNICA</h2>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', fontWeight: 'bold' }}>Nº {invoice.invoiceNumber}</p>
          <p style={{ margin: 0, color: '#4b5563', fontSize: '0.875rem' }}>Chave NFe: {invoice.nfeKey}</p>
        </div>
      </div>

      {/* Dados do Cliente */}
      <div style={{ marginBottom: '2rem', border: '1px solid #e5e7eb', padding: '1rem', borderRadius: '0.5rem' }}>
        <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#374151', fontSize: '1.125rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>Dados do Cliente</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.9rem' }}>
          <div><strong>Razão Social:</strong> {invoice.customer.name}</div>
          <div><strong>CNPJ/CPF:</strong> {invoice.customer.document || 'Não informado'}</div>
          <div><strong>Telefone:</strong> {invoice.customer.phone || 'Não informado'}</div>
          <div><strong>E-mail:</strong> {invoice.customer.email || 'Não informado'}</div>
          <div style={{ gridColumn: 'span 2' }}><strong>Endereço:</strong> {invoice.customer.address || 'Não informado'}</div>
        </div>
      </div>

      {/* Itens da Nota Fiscal */}
      <div style={{ marginBottom: '2rem', border: '1px solid #e5e7eb', padding: '1rem', borderRadius: '0.5rem' }}>
        <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#374151', fontSize: '1.125rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>Itens</h3>
        
        {invoice.items.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ textAlign: 'left', padding: '0.5rem' }}>Descrição</th>
                <th style={{ textAlign: 'center', padding: '0.5rem' }}>Qtd</th>
                <th style={{ textAlign: 'right', padding: '0.5rem' }}>Valor Unit.</th>
                <th style={{ textAlign: 'right', padding: '0.5rem' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map(item => (
                <tr key={item.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '0.5rem' }}>{item.product.name}</td>
                  <td style={{ textAlign: 'center', padding: '0.5rem' }}>{item.quantity}</td>
                  <td style={{ textAlign: 'right', padding: '0.5rem' }}>R$ {item.unitPrice.toFixed(2).replace('.', ',')}</td>
                  <td style={{ textAlign: 'right', padding: '0.5rem' }}>R$ {item.total.toFixed(2).replace('.', ',')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ color: '#6b7280', margin: 0 }}>Nenhum item na nota fiscal.</p>
        )}
      </div>

      {/* Valor Total */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '2rem' }}>
        <div style={{ textAlign: 'right', minWidth: '300px' }}>
          <p style={{ fontSize: '1rem', color: '#4b5563', margin: '0.5rem 0' }}>Subtotal: R$ {invoice.totalAmount.toFixed(2).replace('.', ',')}</p>
          <p style={{ fontSize: '1rem', color: '#4b5563', margin: '0.5rem 0' }}>ICMS: R$ 0,00</p>
          <p style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#dc2626', margin: '1rem 0 0 0', paddingTop: '0.5rem', borderTop: '2px solid #e5e7eb' }}>
            Total: R$ {invoice.totalAmount.toFixed(2).replace('.', ',')}
          </p>
        </div>
      </div>

      {/* Status e Data */}
      <div style={{ marginBottom: '2rem', borderTop: '1px solid #e5e7eb', paddingTop: '1rem', fontSize: '0.9rem' }}>
        <p style={{ margin: '0.5rem 0' }}><strong>Status:</strong> {invoice.status === 'PENDING' ? 'Pendente' : invoice.status === 'ISSUED' ? 'Emitida' : 'Cancelada'}</p>
        <p style={{ margin: '0.5rem 0' }}><strong>Data de Emissão:</strong> {new Date(invoice.createdAt).toLocaleDateString('pt-BR')}</p>
        <p style={{ margin: 0 }}><strong>Validade:</strong> {new Date(new Date(invoice.createdAt).getTime() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR')}</p>
      </div>

      {/* Ações */}
      <div style={{ marginTop: '3rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
        <a href={`/api/nfe/${invoice.invoiceNumber}/download`} className="btn btn-primary" style={{ textDecoration: 'none', padding: '0.75rem 1.5rem' }} download>
          📥 Baixar NFe (PDF)
        </a>
        <Link href="/nfe" style={{ display: 'inline-block', textDecoration: 'none', padding: '0.75rem 1.5rem' }} className="btn btn-outline">
          ← Voltar
        </Link>
        {invoice.status !== 'CANCELLED' && (
          <form action={cancelAction} style={{ display: 'inline' }}>
            <button type="submit" className="btn" style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '0.375rem', cursor: 'pointer' }}>
              ✕ Cancelar NFe
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
