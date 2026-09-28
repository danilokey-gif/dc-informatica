import { prisma } from '@/lib/prisma'
import { getCompanySettings } from "@/lib/settings"
import { getCurrentUser } from "@/lib/auth"
import { notFound } from 'next/navigation'
import PrintButton from './PrintButton'
import DownloadPdfButton from '@/components/DownloadPdfButton'
import WhatsAppButton from '../../../os/[id]/imprimir/WhatsAppButton'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function ImprimirOrcamentoPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params
  const [quote, settings, user] = await Promise.all([
    prisma.quote.findUnique({
      where: { id: resolvedParams.id },
      include: {
        customer: true,
        items: true,
      }
    }),
    getCompanySettings(),
    getCurrentUser(),
  ])

  if (!quote) notFound()

  const produtos = quote.items.filter(i => !i.isService)
  const servicos = quote.items.filter(i => i.isService)

  const telefoneCliente = quote.customer?.phone?.replace(/\D/g, '') || ''
  const numeroOrcamento = quote.id.slice(-6).toUpperCase()
  const totalFormatado = quote.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const listaItens = [
    ...produtos.map(item => `${item.quantity}x ${item.name}`),
    ...servicos.map(item => `${item.quantity}x ${item.name}`)
  ].join('\n')

  const mensagemWhatsApp = [
    `Olá${quote.customer ? ' ' + quote.customer.name : ''}! 👋`,
    ``,
    `Segue o orçamento solicitado na *${settings.name}*:`,
    ``,
    `📋 *Orçamento Nº:* ${numeroOrcamento}`,
    `📦 *Itens:*`,
    listaItens,
    `💰 *Total:* ${totalFormatado}`,
    `📅 *Validade:* ${quote.validUntil ? quote.validUntil.toLocaleDateString('pt-BR') : '15 dias'}`,
    ``,
    `Ficamos à disposição para fecharmos negócio!`,
    settings.phone ? `📞 ${settings.phone}` : '',
  ].filter(Boolean).join('\n')

  const linkWhatsApp = telefoneCliente
    ? `https://wa.me/55${telefoneCliente}?text=${encodeURIComponent(mensagemWhatsApp)}`
    : `https://wa.me/?text=${encodeURIComponent(mensagemWhatsApp)}`

  return (
    <div style={{ maxWidth: '210mm', margin: '0 auto', background: '#fff', color: '#111827', minHeight: '100vh', padding: '20px' }}>
      {user ? (
        <div className="print-hide" style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
          <Link href="/orcamentos" className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ArrowLeft size={18} />
            Voltar
          </Link>
          <PrintButton />
          <DownloadPdfButton filename={`Orcamento-${numeroOrcamento}`} />
          <WhatsAppButton link={linkWhatsApp} temTelefone={!!telefoneCliente} />
        </div>
      ) : (
        <div className="print-hide" style={{ textAlign: 'center', marginBottom: '2rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <PrintButton />
          <DownloadPdfButton filename={`Orcamento-${numeroOrcamento}`} />
        </div>
      )}

      <div className="print-area">
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body { background: #fff !important; }
            .print-hide { display: none !important; }
            .print-area { padding: 0 !important; margin: 0 !important; font-size: 14px; }
            .sidebar { display: none !important; }
            .app-content { padding: 0 !important; margin: 0 !important; }
            @page { margin: 1cm; }
          }
          .print-area * { color: #111827; }
          .premium-header { display: flex; align-items: center; border-bottom: 2px solid #e5e7eb; padding-bottom: 1rem; margin-bottom: 1.5rem; gap: 1.5rem; }
          .premium-title { font-size: 1.5rem; font-weight: bold; color: #1f2937 !important; text-transform: uppercase; }
          .premium-box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem; }
          .premium-box-title { font-weight: bold; color: #4b5563 !important; margin-bottom: 0.5rem; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.25rem; text-transform: uppercase; font-size: 0.875rem; }
          .premium-table { width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; }
          .premium-table th, .premium-table td { border: 1px solid #e5e7eb; padding: 0.5rem; text-align: left; }
          .premium-table th { background: #f9fafb; font-weight: bold; color: #4b5563 !important; }
          .grid-info { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }

          @media (max-width: 600px) {
            .premium-header { flex-direction: column; text-align: center; gap: 0.5rem; }
            .premium-header > div { text-align: center !important; }
            .premium-title { font-size: 1.25rem; }
            .grid-info { grid-template-columns: 1fr; }
            .premium-table { font-size: 0.8rem; }
            .premium-table th, .premium-table td { padding: 0.25rem; }
          }
        `}} />

        <div className="premium-header">
          {settings.logo && (
            <div style={{ width: '120px', height: 'auto', flexShrink: 0 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={settings.logo} alt="Logo da Empresa" style={{ maxWidth: '100%', maxHeight: '80px', objectFit: 'contain' }} />
            </div>
          )}
          <div style={{ flex: 1 }}>
            <h1 className="premium-title">Orçamento #{quote.id.slice(-6).toUpperCase()}</h1>
            <p style={{ margin: 0, color: '#4b5563', fontSize: '0.9rem' }}>{settings.name}</p>
            {settings.document && <p style={{ margin: 0, color: '#4b5563', fontSize: '0.9rem' }}>CNPJ/CPF: {settings.document}</p>}
            {settings.phone && <p style={{ margin: 0, color: '#4b5563', fontSize: '0.9rem' }}>Tel: {settings.phone}</p>}
          </div>
          <div style={{ textAlign: 'right', fontSize: '0.9rem', color: '#4b5563' }}>
            <p style={{ margin: 0 }}><strong>Data:</strong> {quote.createdAt.toLocaleDateString('pt-BR')}</p>
            {quote.validUntil && (
              <p style={{ margin: 0 }}><strong>Validade:</strong> {quote.validUntil.toLocaleDateString('pt-BR')}</p>
            )}
          </div>
        </div>

        {quote.customer && (
          <div className="premium-box">
            <div className="premium-box-title">Dados do Cliente</div>
            <div className="grid-info">
              <div><strong>Nome:</strong> {quote.customer.name}</div>
              {quote.customer.document && <div><strong>Documento:</strong> {quote.customer.document}</div>}
              {quote.customer.phone && <div><strong>Telefone:</strong> {quote.customer.phone}</div>}
              {quote.customer.email && <div><strong>E-mail:</strong> {quote.customer.email}</div>}
              {quote.customer.address && <div style={{ gridColumn: '1 / -1' }}><strong>Endereço:</strong> {quote.customer.address}</div>}
            </div>
          </div>
        )}

        {produtos.length > 0 && (
          <>
            <div className="premium-box-title" style={{ border: 'none', marginBottom: '0.5rem', fontSize: '1rem' }}>Produtos</div>
            <table className="premium-table">
              <thead>
                <tr>
                  <th style={{ width: '50%' }}>Descrição</th>
                  <th style={{ width: '10%', textAlign: 'center' }}>Qtd.</th>
                  <th style={{ width: '20%', textAlign: 'right' }}>V. Unit.</th>
                  <th style={{ width: '20%', textAlign: 'right' }}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {produtos.map(item => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                    <td style={{ textAlign: 'right' }}>{item.unitPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td style={{ textAlign: 'right' }}>{(item.unitPrice * item.quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {servicos.length > 0 && (
          <>
            <div className="premium-box-title" style={{ border: 'none', marginBottom: '0.5rem', fontSize: '1rem', marginTop: '1.5rem' }}>Serviços</div>
            <table className="premium-table">
              <thead>
                <tr>
                  <th style={{ width: '50%' }}>Descrição</th>
                  <th style={{ width: '10%', textAlign: 'center' }}>Qtd.</th>
                  <th style={{ width: '20%', textAlign: 'right' }}>V. Unit.</th>
                  <th style={{ width: '20%', textAlign: 'right' }}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {servicos.map(item => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                    <td style={{ textAlign: 'right' }}>{item.unitPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td style={{ textAlign: 'right' }}>{(item.unitPrice * item.quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {quote.notes && (
          <div className="premium-box" style={{ marginTop: '1.5rem' }}>
            <div className="premium-box-title">Observações</div>
            <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{quote.notes}</p>
          </div>
        )}

        <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ background: '#f9fafb', padding: '1rem 2rem', borderRadius: '8px', border: '1px solid #e5e7eb', textAlign: 'right' }}>
            <div style={{ fontSize: '1rem', color: '#4b5563', marginBottom: '0.25rem' }}>Total do Orçamento</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#1f2937' }}>
              {quote.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
          </div>
        </div>

        <div style={{ marginTop: '4rem', textAlign: 'center', color: '#6b7280', fontSize: '0.875rem' }}>
          <p>Este orçamento é válido até {quote.validUntil ? quote.validUntil.toLocaleDateString('pt-BR') : 'a data especificada pelo vendedor'}.</p>
        </div>
      </div>
    </div>
  )
}
