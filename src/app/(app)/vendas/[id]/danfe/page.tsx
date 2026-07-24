import { prisma } from "@/lib/prisma"
import { getCompanySettings } from "@/lib/settings"
import { notFound } from "next/navigation"
import { gerarCode128DataUrl } from "@/lib/barcode"
import PrintButton from "../../../os/[id]/imprimir/PrintButton"

export const dynamic = 'force-dynamic'

export default async function DanfePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [venda, empresa] = await Promise.all([
    prisma.sale.findUnique({
      where: { id },
      include: {
        customer: true,
        items: { include: { product: true } },
        nfeEmissoes: { where: { status: 'AUTORIZADA' }, orderBy: { createdAt: 'desc' } },
      }
    }),
    getCompanySettings(),
  ])

  if (!venda) notFound()

  const emissao = venda.nfeEmissoes[0]
  if (!emissao || !emissao.chaveAcesso) {
    return (
      <div className="animate-fade-in" style={{ maxWidth: '600px', margin: '2rem auto', textAlign: 'center' }}>
        <p>Esta venda ainda não tem uma NF-e autorizada.</p>
      </div>
    )
  }

  const barcodeDataUrl = await gerarCode128DataUrl(emissao.chaveAcesso)
  const chaveFormatada = emissao.chaveAcesso.match(/.{1,4}/g)?.join(' ') || emissao.chaveAcesso
  const totalFormatado = venda.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <div style={{ backgroundColor: 'white', color: 'black', padding: '2rem', maxWidth: '800px', margin: '0 auto', fontFamily: 'Arial, sans-serif', fontSize: '0.85rem' }}>
      {emissao.ambiente !== 'producao' && (
        <div style={{ textAlign: 'center', backgroundColor: '#fee2e2', color: '#991b1b', fontWeight: 'bold', padding: '0.5rem', marginBottom: '1rem', border: '1px solid #991b1b' }}>
          NF-E EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO — SEM VALOR FISCAL
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid black', padding: '0.75rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {empresa.logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={empresa.logo} alt={empresa.name} style={{ height: '45px', width: '45px', objectFit: 'contain' }} />
          )}
          <div>
            <strong>{empresa.name}</strong><br />
            CNPJ: {empresa.document}<br />
            IE: {empresa.inscricaoEstadual}
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ margin: 0, fontSize: '1.1rem' }}>DANFE</h1>
          <p style={{ margin: 0, fontSize: '0.7rem' }}>Documento Auxiliar da<br />Nota Fiscal Eletrônica</p>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem' }}>Nº {emissao.numero} — Série {emissao.serie}</p>
        </div>
      </div>

      <div style={{ border: '1px solid black', padding: '0.75rem', textAlign: 'center', marginBottom: '1rem' }}>
        <p style={{ fontFamily: 'monospace', fontSize: '0.9rem', margin: 0 }}>{chaveFormatada}</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={barcodeDataUrl} alt="Código de barras da chave de acesso" style={{ height: '50px', margin: '0.5rem auto' }} />
        <p className="text-muted" style={{ fontSize: '0.7rem', margin: 0 }}>
          Consulte a autenticidade em www.nfe.fazenda.gov.br
        </p>
      </div>

      <div style={{ border: '1px solid black', padding: '0.5rem', marginBottom: '1rem' }}>
        <strong>Destinatário:</strong> {venda.customer?.name || 'Consumidor não identificado'}
        {venda.customer?.document && <> — Documento: {venda.customer.document}</>}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
        <thead>
          <tr>
            <th style={{ border: '1px solid black', padding: '0.35rem' }}>Código</th>
            <th style={{ border: '1px solid black', padding: '0.35rem' }}>Descrição</th>
            <th style={{ border: '1px solid black', padding: '0.35rem' }}>NCM</th>
            <th style={{ border: '1px solid black', padding: '0.35rem' }}>CFOP</th>
            <th style={{ border: '1px solid black', padding: '0.35rem' }}>Qtd.</th>
            <th style={{ border: '1px solid black', padding: '0.35rem' }}>Vl. Unit.</th>
            <th style={{ border: '1px solid black', padding: '0.35rem' }}>Vl. Total</th>
          </tr>
        </thead>
        <tbody>
          {venda.items.map(item => (
            <tr key={item.id}>
              <td style={{ border: '1px solid black', padding: '0.35rem' }}>{item.product.sku || '-'}</td>
              <td style={{ border: '1px solid black', padding: '0.35rem' }}>{item.product.name}</td>
              <td style={{ border: '1px solid black', padding: '0.35rem' }}>{item.product.ncm || '-'}</td>
              <td style={{ border: '1px solid black', padding: '0.35rem' }}>{item.product.cfop || '-'}</td>
              <td style={{ border: '1px solid black', padding: '0.35rem' }}>{item.quantity}</td>
              <td style={{ border: '1px solid black', padding: '0.35rem' }}>{item.unitPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
              <td style={{ border: '1px solid black', padding: '0.35rem' }}>{(item.unitPrice * item.quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ border: '1px solid black', padding: '0.5rem', textAlign: 'right' }}>
        <strong>Valor Total da Nota: {totalFormatado}</strong>
      </div>

      <div className="no-print" style={{ marginTop: '2rem', textAlign: 'center' }}>
        <PrintButton />
      </div>
    </div>
  )
}
