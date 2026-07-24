import { prisma } from "@/lib/prisma"
import { getCompanySettings, getNfeConfig } from "@/lib/settings"
import { notFound } from "next/navigation"
import PrintButton from "../../../os/[id]/imprimir/PrintButton"
import WhatsAppButton from "../../../os/[id]/imprimir/WhatsAppButton"
import { updateSaleInvoice } from "../../actions"
import { gerarPixCopiaECola, gerarPixQrCodeDataUrl } from "@/lib/pix"
import CopyPixButton from "../../../os/[id]/imprimir/CopyPixButton"
import { emitirNfeVenda } from "./nfe-actions"

export default async function ImprimirVendaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [venda, settings, nfeConfig] = await Promise.all([
    prisma.sale.findUnique({
      where: { id },
      include: { customer: true, items: { include: { product: true } }, nfeEmissoes: { orderBy: { createdAt: 'desc' } } }
    }),
    getCompanySettings(),
    getNfeConfig()
  ])

  if (!venda) {
    notFound()
  }

  const nfeConfigurada = !!(nfeConfig.certificado && settings.inscricaoEstadual && settings.enderLogradouro && nfeConfig.codigoMunicipio)
  const ultimaEmissaoNfe = venda.nfeEmissoes[0]
  const nfeAutorizada = ultimaEmissaoNfe?.status === 'AUTORIZADA'
  const emitirNfeAction = emitirNfeVenda.bind(null, venda.id)

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

      {/* Emissão automática de NF-e */}
      <div className="no-print" style={{ marginTop: '2rem', border: '1px solid #e5e7eb', padding: '1rem', borderRadius: '0.5rem' }}>
        <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#374151', fontSize: '1.125rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>Nota Fiscal de Produtos (NF-e)</h3>

        {!nfeConfigurada && (
          <p style={{ fontSize: '0.875rem', color: '#b91c1c', marginBottom: '1rem' }}>
            Configuração fiscal incompleta. Vá em Configurações {'>'} Nota Fiscal de Produtos e Dados da Empresa para cadastrar certificado, Inscrição Estadual e endereço.
          </p>
        )}

        {ultimaEmissaoNfe && (
          <div style={{ marginBottom: '1rem', fontSize: '0.875rem' }}>
            <p style={{ margin: 0 }}>
              <strong>Status:</strong>{' '}
              {ultimaEmissaoNfe.status === 'AUTORIZADA' && <span style={{ color: '#16a34a' }}>Autorizada</span>}
              {ultimaEmissaoNfe.status === 'REJEITADA' && <span style={{ color: '#b91c1c' }}>Rejeitada</span>}
              {ultimaEmissaoNfe.status === 'PROCESSANDO' && <span>Processando</span>}
              {' '}(NF-e nº {ultimaEmissaoNfe.numero}, série {ultimaEmissaoNfe.serie}, ambiente {ultimaEmissaoNfe.ambiente})
            </p>
            {ultimaEmissaoNfe.chaveAcesso && <p style={{ margin: '0.25rem 0 0 0' }}><strong>Chave de acesso:</strong> {ultimaEmissaoNfe.chaveAcesso}</p>}
            {ultimaEmissaoNfe.motivoErro && <p style={{ margin: '0.25rem 0 0 0', color: '#b91c1c' }}><strong>Motivo:</strong> {ultimaEmissaoNfe.motivoErro}</p>}
          </div>
        )}

        {!nfeAutorizada && (
          <form action={emitirNfeAction}>
            <button type="submit" className="btn btn-primary" disabled={!nfeConfigurada}>
              {ultimaEmissaoNfe?.status === 'REJEITADA' ? 'Tentar Emitir Novamente' : 'Emitir NF-e'}
            </button>
          </form>
        )}
      </div>

      {/* Nota Fiscal (registro manual) */}
      <div className="no-print" style={{ marginTop: '2rem', border: '1px solid #e5e7eb', padding: '1rem', borderRadius: '0.5rem' }}>
        <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#374151', fontSize: '1.125rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>Registro Manual (NF-e/NFC-e emitida por fora)</h3>
        <p style={{ fontSize: '0.875rem', color: '#4b5563', marginBottom: '1rem' }}>
          Se preferir emitir por outro emissor (ex: Sebrae), registre o número aqui.
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
