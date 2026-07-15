import { prisma } from "@/lib/prisma"
import { getCompanySettings, getNfseConfig } from "@/lib/settings"
import { notFound } from "next/navigation"
import PrintButton from "./PrintButton"
import WhatsAppButton from "./WhatsAppButton"
import { emitirNfseServiceOrder } from "./nfse-actions"
import { gerarContaReceberOS } from "../../../financeiro/actions"

export default async function ImprimirOSPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [os, settings, nfseConfig] = await Promise.all([
    prisma.serviceOrder.findUnique({
      where: { id },
      include: { customer: true, technician: true, nfseEmissoes: { orderBy: { createdAt: 'desc' } }, transactions: true }
    }),
    getCompanySettings(),
    getNfseConfig()
  ])

  if (!os) {
    notFound()
  }

  const gerarContaAction = gerarContaReceberOS.bind(null, os.id)
  const jaTemContaReceber = os.transactions.some(t => t.type === 'RECEITA')

  const nfseConfigurada = !!(nfseConfig.certificado && nfseConfig.codigoMunicipio && nfseConfig.codigoServico && nfseConfig.aliquotaIss !== null)
  const ultimaEmissao = os.nfseEmissoes[0]
  const nfseAutorizada = ultimaEmissao?.status === 'AUTORIZADA'
  const emitirNfseAction = emitirNfseServiceOrder.bind(null, os.id)

  const tipoDocumento = os.status === 'BUDGET' ? 'ORÇAMENTO' : (os.status === 'DELIVERED' ? 'RECIBO / GARANTIA' : 'ORDEM DE SERVIÇO')
  const numeroOS = os.id.slice(-6).toUpperCase()
  const valor = os.price ? `R$ ${os.price.toFixed(2).replace('.', ',')}` : 'A combinar'
  const telefoneCliente = os.customer.phone?.replace(/\D/g, '') || ''

  // Monta mensagem do WhatsApp
  const mensagemWhatsApp = [
    `Olá ${os.customer.name}! 👋`,
    ``,
    `Segue o resumo da sua *${tipoDocumento}* na *${settings.name}*:`,
    ``,
    `🔧 *OS Nº:* ${numeroOS}`,
    `💻 *Aparelho:* ${os.device}`,
    `📋 *Defeito:* ${os.issue}`,
    os.technicalReport ? `✅ *Solução:* ${os.technicalReport}` : '',
    `💰 *Valor:* ${valor}`,
    ``,
    `Qualquer dúvida, estamos à disposição!`,
    settings.phone ? `📞 ${settings.phone}` : '',
  ].filter(Boolean).join('\n')

  const linkWhatsApp = telefoneCliente
    ? `https://wa.me/55${telefoneCliente}?text=${encodeURIComponent(mensagemWhatsApp)}`
    : `https://wa.me/?text=${encodeURIComponent(mensagemWhatsApp)}`

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
            <p style={{ margin: '0.25rem 0 0 0', color: '#4b5563', fontSize: '0.875rem' }}>Assistência Técnica Especializada</p>
            {settings.phone && <p style={{ margin: 0, color: '#4b5563', fontSize: '0.875rem' }}>WhatsApp: {settings.phone}</p>}
          </div>
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
          {os.technician && <p style={{ marginBottom: '0.5rem' }}><strong>Técnico Responsável:</strong><br /> {os.technician.name}</p>}
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

      {/* Financeiro */}
      <div className="no-print" style={{ marginTop: '2rem', border: '1px solid #e5e7eb', padding: '1rem', borderRadius: '0.5rem' }}>
        <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#374151', fontSize: '1.125rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>Financeiro</h3>
        {jaTemContaReceber ? (
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Conta a receber já gerada para esta OS. <a href="/financeiro/contas" className="text-primary">Ver em Financeiro</a>.</p>
        ) : os.price ? (
          <form action={gerarContaAction}>
            <button type="submit" className="btn btn-outline">Gerar Conta a Receber ({os.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})</button>
          </form>
        ) : (
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Defina o valor da OS para gerar a conta a receber.</p>
        )}
      </div>

      {/* Nota Fiscal de Serviço */}
      <div className="no-print" style={{ marginTop: '2rem', border: '1px solid #e5e7eb', padding: '1rem', borderRadius: '0.5rem' }}>
        <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#374151', fontSize: '1.125rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>Nota Fiscal de Serviço (NFS-e)</h3>

        {!nfseConfigurada && (
          <p style={{ fontSize: '0.875rem', color: '#b91c1c', marginBottom: '1rem' }}>
            Configuração fiscal incompleta. Vá em Configurações {'>'} Nota Fiscal de Serviço para cadastrar o certificado digital, município e alíquota de ISS.
          </p>
        )}

        {ultimaEmissao && (
          <div style={{ marginBottom: '1rem', fontSize: '0.875rem' }}>
            <p style={{ margin: 0 }}>
              <strong>Status:</strong>{' '}
              {ultimaEmissao.status === 'AUTORIZADA' && <span style={{ color: '#16a34a' }}>Autorizada</span>}
              {ultimaEmissao.status === 'REJEITADA' && <span style={{ color: '#b91c1c' }}>Rejeitada</span>}
              {ultimaEmissao.status === 'PROCESSANDO' && <span>Processando</span>}
              {' '}(DPS nº {ultimaEmissao.numeroDps}, série {ultimaEmissao.serieDps}, ambiente {ultimaEmissao.ambiente})
            </p>
            {ultimaEmissao.chaveAcesso && <p style={{ margin: '0.25rem 0 0 0' }}><strong>Chave de acesso:</strong> {ultimaEmissao.chaveAcesso}</p>}
            {ultimaEmissao.motivoErro && <p style={{ margin: '0.25rem 0 0 0', color: '#b91c1c' }}><strong>Motivo:</strong> {ultimaEmissao.motivoErro}</p>}
          </div>
        )}

        {!nfseAutorizada && (
          <form action={emitirNfseAction}>
            <button type="submit" className="btn btn-primary" disabled={!nfseConfigurada}>
              {ultimaEmissao?.status === 'REJEITADA' ? 'Tentar Emitir Novamente' : 'Emitir NFS-e'}
            </button>
          </form>
        )}
      </div>

      {/* Botões de ação */}
      <div className="no-print" style={{ marginTop: '3rem', display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        <PrintButton />
        <WhatsAppButton link={linkWhatsApp} temTelefone={!!telefoneCliente} />
        {os.customer.email && (
          <a
            href={`mailto:${os.customer.email}?subject=OS ${numeroOS} - ${settings.name}&body=${encodeURIComponent(`Olá ${os.customer.name},\n\nSegue o resumo da sua ${tipoDocumento}:\n\nOS Nº: ${numeroOS}\nAparelho: ${os.device}\nDefeito: ${os.issue}\nValor: ${valor}\n\nQualquer dúvida, entre em contato:\n${settings.phone || ''}`)}`}
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
