import { prisma } from "@/lib/prisma"
import { getCompanySettings } from "@/lib/settings"
import { notFound } from "next/navigation"
import PrintButton from "../../../os/[id]/imprimir/PrintButton"
import WhatsAppButton from "../../../os/[id]/imprimir/WhatsAppButton"
import { updateSaleInvoice } from "../../actions"
import { gerarPixCopiaECola, gerarPixQrCodeDataUrl } from "@/lib/pix"
import CopyPixButton from "../../../os/[id]/imprimir/CopyPixButton"

export default async function ImprimirVendaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [venda, settings] = await Promise.all([
    prisma.sale.findUnique({
      where: { id },
      include: { customer: true, items: { include: { product: true } } }
    }),
    getCompanySettings()
  ])

  if (!venda) {
    notFound()
  }

  const numeroVenda = venda.id.slice(-6).toUpperCase()
  const totalFormatado = venda.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const telefoneCliente = venda.customer?.phone?.replace(/\D/g, '') || ''
  const updateInvoiceAction = updateSaleInvoice.bind(null, venda.id)

  const listaItens = venda.items.map(item => `${item.quantity}x ${item.product.name}`).join('\n')

  const mensagemWhatsApp = [
    `Olá${venda.customer ? ' ' + venda.customer.name : ''}! 👋`,
    ``,
    `Segue o recibo da sua compra na *${settings.name}*:`,
    ``,
    `🧾 *Venda Nº:* ${numeroVenda}`,
    `📦 *Itens:*`,
    listaItens,
    `💰 *Total:* ${totalFormatado}`,
    `💳 *Pagamento:* ${venda.paymentMethod}`,
    venda.invoiceNumber ? `📄 *Nota Fiscal:* ${venda.invoiceType} ${venda.invoiceNumber}` : '',
    ``,
    `Obrigado pela preferência!`,
    settings.phone ? `📞 ${settings.phone}` : '',
  ].filter(Boolean).join('\n')

  const linkWhatsApp = telefoneCliente
    ? `https://wa.me/55${telefoneCliente}?text=${encodeURIComponent(mensagemWhatsApp)}`
    : `https://wa.me/?text=${encodeURIComponent(mensagemWhatsApp)}`

  const pixConfigurado = !!(settings.pixKey && settings.pixCity)
  let pixQrCodeDataUrl: string | null = null
  let pixCopiaECola: string | null = null
  if (pixConfigurado) {
    pixCopiaECola = gerarPixCopiaECola({
      pixKey: settings.pixKey!,
      merchantName: settings.name,
      merchantCity: settings.pixCity!,
      amount: venda.total,
      txid: venda.id,
    })
    pixQrCodeDataUrl = await gerarPixQrCodeDataUrl(pixCopiaECola)
  }

  return (
    <div style={{ backgroundColor: 'white', color: 'black', padding: '2rem', maxWidth: '800px', margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #dc2626', paddingBottom: '1rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {settings.logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.logo} alt={settings.name} style={{ height: '50px', width: '50px', objectFit: 'contain' }} />
          )}
          <div>
            <h1 style={{ color: '#dc2626', margin: 0, fontSize: '2rem' }}>{settings.name}</h1>
            <p style={{ margin: '0.25rem 0 0 0', color: '#4b5563', fontSize: '0.875rem' }}>Loja e Assistência Técnica</p>
            {settings.phone && <p style={{ margin: 0, color: '#4b5563', fontSize: '0.875rem' }}>WhatsApp: {settings.phone}</p>}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#111827' }}>RECIBO DE VENDA</h2>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1rem', fontWeight: 'bold' }}>Nº {numeroVenda}</p>
          <p style={{ margin: 0, color: '#4b5563', fontSize: '0.875rem' }}>Data: {new Date(venda.createdAt).toLocaleDateString('pt-BR')}</p>
        </div>
      </div>

      {/* Cliente */}
      <div style={{ marginBottom: '2rem', border: '1px solid #e5e7eb', padding: '1rem', borderRadius: '0.5rem' }}>
        <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#374151', fontSize: '1.125rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>Cliente</h3>
        <div style={{ fontSize: '0.9rem' }}>
          {venda.customer ? (
            <>
              <div><strong>Nome:</strong> {venda.customer.name}</div>
              <div><strong>Documento:</strong> {venda.customer.document || 'N/A'}</div>
            </>
          ) : (
            <div className="text-muted">Cliente não identificado</div>
          )}
        </div>
      </div>

      {/* Itens */}
      <div style={{ marginBottom: '2rem', border: '1px solid #e5e7eb', padding: '1rem', borderRadius: '0.5rem' }}>
        <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#374151', fontSize: '1.125rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>Itens</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
              <th style={{ padding: '0.5rem 0' }}>Produto</th>
              <th style={{ padding: '0.5rem 0' }}>Qtd.</th>
              <th style={{ padding: '0.5rem 0' }}>Preço Unit.</th>
              <th style={{ padding: '0.5rem 0', textAlign: 'right' }}>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {venda.items.map(item => (
              <tr key={item.id}>
                <td style={{ padding: '0.5rem 0' }}>{item.product.name}</td>
                <td style={{ padding: '0.5rem 0' }}>{item.quantity}</td>
                <td style={{ padding: '0.5rem 0' }}>{item.unitPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                <td style={{ padding: '0.5rem 0', textAlign: 'right' }}>{(item.unitPrice * item.quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Valor e Pagamento */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '2rem' }}>
        <div>
          <p style={{ fontSize: '0.9rem', color: '#4b5563', margin: 0 }}>Forma de Pagamento: <strong>{venda.paymentMethod}</strong></p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '1rem', color: '#4b5563', margin: 0 }}>Valor Total:</p>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#dc2626', margin: 0 }}>{totalFormatado}</p>
        </div>
      </div>

      {/* Cobrança via Pix */}
      {pixQrCodeDataUrl && pixCopiaECola && (
        <div className="no-print" style={{ marginTop: '2rem', border: '1px solid #e5e7eb', padding: '1rem', borderRadius: '0.5rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#374151', fontSize: '1.125rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>Cobrança via Pix</h3>
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pixQrCodeDataUrl} alt="QR Code Pix" style={{ width: '160px', height: '160px' }} />
            <div style={{ flex: 1, minWidth: '250px' }}>
              <p style={{ fontSize: '0.875rem', color: '#4b5563', marginBottom: '0.75rem' }}>
                Peça para o cliente escanear o QR code ou copiar o código Pix abaixo.
              </p>
              <CopyPixButton copiaECola={pixCopiaECola} />
            </div>
          </div>
        </div>
      )}

      {/* Nota Fiscal */}
      <div className="no-print" style={{ marginTop: '2rem', border: '1px solid #e5e7eb', padding: '1rem', borderRadius: '0.5rem' }}>
        <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#374151', fontSize: '1.125rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>Nota Fiscal</h3>
        <p style={{ fontSize: '0.875rem', color: '#4b5563', marginBottom: '1rem' }}>
          Este recibo não tem valor fiscal. Emita a nota no portal do governo e registre o número aqui.
        </p>
        <div className="flex gap-4 mb-4" style={{ flexWrap: 'wrap' }}>
          <a href="https://26408013848.emissornfe.sebrae.com.br" target="_blank" rel="noopener noreferrer" className="btn btn-outline">Emitir NF-e/NFC-e (Sebrae)</a>
        </div>
        <form action={updateInvoiceAction} className="flex gap-4" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label" htmlFor="invoiceType">Tipo</label>
            <select id="invoiceType" name="invoiceType" className="input-field" defaultValue={venda.invoiceType || ''}>
              <option value="">-</option>
              <option value="NFS-e">NFS-e</option>
              <option value="NF-e">NF-e</option>
              <option value="NFC-e">NFC-e</option>
            </select>
          </div>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label" htmlFor="invoiceNumber">Número da Nota</label>
            <input type="text" id="invoiceNumber" name="invoiceNumber" className="input-field" defaultValue={venda.invoiceNumber || ''} />
          </div>
          <button type="submit" className="btn btn-primary">Salvar</button>
        </form>
      </div>

      {venda.invoiceNumber && (
        <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#4b5563' }}>
          <strong>{venda.invoiceType}:</strong> {venda.invoiceNumber}
        </p>
      )}

      {/* Botões de ação */}
      <div className="no-print" style={{ marginTop: '3rem', display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        <PrintButton />
        <WhatsAppButton link={linkWhatsApp} temTelefone={!!telefoneCliente} />
      </div>
    </div>
  )
}
