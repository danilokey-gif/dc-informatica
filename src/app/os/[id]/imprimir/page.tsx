import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import PrintButton from "./PrintButton"
import WhatsAppButton from "./WhatsAppButton"

export default async function ImprimirOSPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  
  const os = await prisma.serviceOrder.findUnique({
    where: { id },
    include: { customer: true }
  })

  if (!os) {
    notFound()
  }

  const tipoDocumento = os.status === 'BUDGET' ? 'ORÇAMENTO' : (os.status === 'DELIVERED' ? 'RECIBO / GARANTIA' : 'ORDEM DE SERVIÇO')
  const numeroOS = os.id.slice(-6).toUpperCase()
  const valor = os.price ? `R$ ${os.price.toFixed(2).replace('.', ',')}` : 'A combinar'
  const telefoneCliente = os.customer.phone?.replace(/\D/g, '') || ''

  // Monta mensagem do WhatsApp
  const mensagemWhatsApp = [
    `Olá ${os.customer.name}! 👋`,
    ``,
    `Segue o resumo da sua *${tipoDocumento}* na *Dc Informática*:`,
    ``,
    `🔧 *OS Nº:* ${numeroOS}`,
    `💻 *Aparelho:* ${os.device}`,
    `📋 *Defeito:* ${os.issue}`,
    os.technicalReport ? `✅ *Solução:* ${os.technicalReport}` : '',
    `💰 *Valor:* ${valor}`,
    ``,
    `Qualquer dúvida, estamos à disposição!`,
    `📞 (14) 99743-7540`,
  ].filter(Boolean).join('\n')

  const linkWhatsApp = telefoneCliente
    ? `https://wa.me/55${telefoneCliente}?text=${encodeURIComponent(mensagemWhatsApp)}`
    : `https://wa.me/?text=${encodeURIComponent(mensagemWhatsApp)}`

  return (
    <div style={{ backgroundColor: 'white', color: 'black', padding: '2rem', maxWidth: '800px', margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #dc2626', paddingBottom: '1rem', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ color: '#dc2626', margin: 0, fontSize: '2rem' }}>Dc Informática</h1>
          <p style={{ margin: '0.25rem 0 0 0', color: '#4b5563', fontSize: '0.875rem' }}>Assistência Técnica Especializada</p>
          <p style={{ margin: 0, color: '#4b5563', fontSize: '0.875rem' }}>WhatsApp: (14) 99743-7540</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#111827' }}>{tipoDocumento}</h2>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1rem', fontWeight: 'bold' }}>Nº {numeroOS}</p>
          <p style={{ margin: 0, color: '#4b5563', fontSize: '0.875rem' }}>Data: {new Date(os.createdAt).toLocaleDateString('pt-BR')}</p>
        </div>
      </div>

      {/* Dados do Cliente */}
      <div style={{ marginBottom: '2rem', border: '1px solid #e5e7eb', padding: '1rem', borderRadius: '0.5rem' }}>
        <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#374151', fontSize: '1.125rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>Dados do Cliente</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.9rem' }}>
          <div><strong>Nome:</strong> {os.customer.name}</div>
          <div><strong>Telefone:</strong> {os.customer.phone || 'N/A'}</div>
          <div><strong>Documento:</strong> {os.customer.document || 'N/A'}</div>
          <div><strong>E-mail:</strong> {os.customer.email || 'N/A'}</div>
          <div style={{ gridColumn: 'span 2' }}><strong>Endereço:</strong> {os.customer.address || 'N/A'}</div>
        </div>
      </div>

      {/* Detalhes do Serviço */}
      <div style={{ marginBottom: '2rem', border: '1px solid #e5e7eb', padding: '1rem', borderRadius: '0.5rem' }}>
        <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#374151', fontSize: '1.125rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>Detalhes do Serviço</h3>
        <div style={{ fontSize: '0.9rem' }}>
          <p style={{ marginBottom: '0.5rem' }}><strong>Aparelho / Marca / Modelo:</strong><br /> {os.device}</p>
          <p style={{ marginBottom: '0.5rem' }}><strong>Defeito Relatado:</strong><br /> {os.issue}</p>
          <p style={{ marginBottom: '0.5rem' }}><strong>Laudo Técnico / Solução:</strong><br /> {os.technicalReport || 'Aguardando avaliação técnica.'}</p>
        </div>
      </div>

      {/* Valor e Assinatura */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '4rem' }}>
        <div style={{ textAlign: 'center', width: '300px' }}>
          <div style={{ borderTop: '1px solid black', paddingTop: '0.5rem', marginTop: '2rem' }}>
            Assinatura do Cliente
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '1rem', color: '#4b5563', margin: 0 }}>Valor Total:</p>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#dc2626', margin: 0 }}>{valor}</p>
        </div>
      </div>

      {/* Botões de ação */}
      <div className="no-print" style={{ marginTop: '3rem', display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        <PrintButton />
        <WhatsAppButton link={linkWhatsApp} temTelefone={!!telefoneCliente} />
        {os.customer.email && (
          <a
            href={`mailto:${os.customer.email}?subject=OS ${numeroOS} - Dc Informática&body=${encodeURIComponent(`Olá ${os.customer.name},\n\nSegue o resumo da sua ${tipoDocumento}:\n\nOS Nº: ${numeroOS}\nAparelho: ${os.device}\nDefeito: ${os.issue}\nValor: ${valor}\n\nQualquer dúvida, entre em contato:\n(14) 99743-7540`)}`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.75rem 1.5rem', borderRadius: '0.5rem', fontWeight: 600,
              fontSize: '1rem', textDecoration: 'none', border: '2px solid #6b7280',
              color: '#374151', backgroundColor: 'white'
            }}
          >
            ✉️ Enviar E-mail
          </a>
        )}
      </div>
    </div>
  )
}
