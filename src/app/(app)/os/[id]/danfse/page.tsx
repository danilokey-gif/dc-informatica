import { prisma } from "@/lib/prisma"
import { getCompanySettings, getNfseConfig } from "@/lib/settings"
import { notFound } from "next/navigation"
import { gerarQrCodeDataUrl } from "@/lib/qrcode-util"
import PrintButton from "../imprimir/PrintButton"

export const dynamic = 'force-dynamic'

const REGIME_LABEL: Record<string, string> = {
  MEI: 'MEI — Microempreendedor Individual (Optante do Simples Nacional)',
  SIMPLES: 'Simples Nacional (ME/EPP)',
  NORMAL: 'Regime Normal (não optante pelo Simples Nacional)',
}

export default async function DanfsePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [os, empresa, nfseConfig] = await Promise.all([
    prisma.serviceOrder.findUnique({
      where: { id },
      include: { customer: true, nfseEmissoes: { where: { status: 'AUTORIZADA' }, orderBy: { createdAt: 'desc' } } }
    }),
    getCompanySettings(),
    getNfseConfig(),
  ])

  if (!os) notFound()

  const emissao = os.nfseEmissoes[0]
  if (!emissao || !emissao.chaveAcesso) {
    return (
      <div className="animate-fade-in" style={{ maxWidth: '600px', margin: '2rem auto', textAlign: 'center' }}>
        <p>Esta Ordem de Serviço ainda não tem uma NFS-e autorizada.</p>
      </div>
    )
  }

  // URL de consulta pública do Sistema Nacional NFS-e (padrão documentado nos manuais oficiais).
  const urlConsulta = `https://www.nfse.gov.br/consultapublica/?chave=${emissao.chaveAcesso}`
  const qrCodeDataUrl = await gerarQrCodeDataUrl(urlConsulta)
  const valorServico = os.price || 0
  const valorFormatado = valorServico.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const chaveFormatada = emissao.chaveAcesso.match(/.{1,4}/g)?.join(' ') || emissao.chaveAcesso
  const codigoVerificacao = emissao.chaveAcesso.slice(-9)
  // ISS do MEI é fixo mensal (DAS), não calculado por nota — alíquota/valor de ISS não se aplicam.
  const ehMei = nfseConfig.regimeTributario === 'MEI'

  const boxStyle: React.CSSProperties = { border: '1px solid #333', padding: '0.6rem' }
  const labelStyle: React.CSSProperties = { fontSize: '0.65rem', color: '#555', textTransform: 'uppercase', letterSpacing: '0.02em' }
  const valueStyle: React.CSSProperties = { fontSize: '0.85rem', fontWeight: 600 }

  return (
    <div style={{ backgroundColor: 'white', color: 'black', padding: '2rem', maxWidth: '800px', margin: '0 auto', fontFamily: 'Arial, sans-serif', fontSize: '0.8rem' }}>
      {emissao.ambiente !== 'producao' && (
        <div style={{ textAlign: 'center', backgroundColor: '#fee2e2', color: '#991b1b', fontWeight: 'bold', padding: '0.5rem', marginBottom: '1rem', border: '1px solid #991b1b' }}>
          NFS-e EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO — SEM VALOR FISCAL
        </div>
      )}

      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #333', borderBottom: '2px solid black', padding: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '30%' }}>
          {empresa.logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={empresa.logo} alt={empresa.name} style={{ height: '40px', width: '40px', objectFit: 'contain' }} />
          )}
          <span style={{ fontSize: '0.7rem' }}>{empresa.name}</span>
        </div>
        <div style={{ textAlign: 'center', width: '40%' }}>
          <h1 style={{ margin: 0, fontSize: '1.15rem' }}>DANFSe</h1>
          <p style={{ margin: 0, fontSize: '0.65rem' }}>Documento Auxiliar da Nota Fiscal de Serviço Eletrônica</p>
        </div>
        <div style={{ textAlign: 'right', width: '30%', fontSize: '0.65rem' }}>
          <div style={labelStyle}>Código de Verificação</div>
          <div style={{ ...valueStyle, fontFamily: 'monospace' }}>{codigoVerificacao}</div>
        </div>
      </div>

      {/* Identificação da NFS-e */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderLeft: '1px solid #333', borderRight: '1px solid #333' }}>
        <div style={boxStyle}><div style={labelStyle}>Número da NFS-e</div><div style={valueStyle}>{emissao.numeroDps}</div></div>
        <div style={boxStyle}><div style={labelStyle}>Série</div><div style={valueStyle}>{emissao.serieDps}</div></div>
        <div style={boxStyle}><div style={labelStyle}>Competência</div><div style={valueStyle}>{emissao.createdAt.toLocaleDateString('pt-BR')}</div></div>
        <div style={boxStyle}><div style={labelStyle}>Data/Hora de Emissão</div><div style={valueStyle}>{emissao.createdAt.toLocaleString('pt-BR')}</div></div>
      </div>

      {/* Prestador */}
      <div style={{ border: '1px solid #333', borderTop: 'none' }}>
        <div style={{ backgroundColor: '#f0f0f0', padding: '0.25rem 0.6rem', fontSize: '0.65rem', fontWeight: 'bold', textTransform: 'uppercase' }}>Prestador de Serviços</div>
        <div style={{ padding: '0.6rem' }}>
          <strong>{empresa.name}</strong> — CNPJ: {empresa.document}<br />
          {empresa.address && <>{empresa.address}<br /></>}
          {empresa.phone && <>Telefone: {empresa.phone}</>}
        </div>
      </div>

      {/* Tomador */}
      <div style={{ border: '1px solid #333', borderTop: 'none' }}>
        <div style={{ backgroundColor: '#f0f0f0', padding: '0.25rem 0.6rem', fontSize: '0.65rem', fontWeight: 'bold', textTransform: 'uppercase' }}>Tomador de Serviços</div>
        <div style={{ padding: '0.6rem' }}>
          <strong>{os.customer.name}</strong> — Documento: {os.customer.document || 'Não informado'}<br />
          {os.customer.address && <>{os.customer.address}</>}
        </div>
      </div>

      {/* Serviço */}
      <div style={{ border: '1px solid #333', borderTop: 'none' }}>
        <div style={{ backgroundColor: '#f0f0f0', padding: '0.25rem 0.6rem', fontSize: '0.65rem', fontWeight: 'bold', textTransform: 'uppercase' }}>Serviço Prestado</div>
        <div style={{ padding: '0.6rem' }}>
          <div style={labelStyle}>Código de Tributação Nacional</div>
          <div style={{ marginBottom: '0.4rem' }}>{nfseConfig.codigoServico}</div>
          <div style={labelStyle}>Discriminação</div>
          <div>{os.device} — {os.issue}</div>
        </div>
      </div>

      {/* Valores */}
      <div style={{ border: '1px solid #333', borderTop: 'none' }}>
        <div style={{ backgroundColor: '#f0f0f0', padding: '0.25rem 0.6rem', fontSize: '0.65rem', fontWeight: 'bold', textTransform: 'uppercase' }}>Valores do Serviço</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <div style={{ padding: '0.6rem' }}><div style={labelStyle}>Valor do Serviço</div><div style={valueStyle}>{valorFormatado}</div></div>
          <div style={{ padding: '0.6rem' }}><div style={labelStyle}>Alíquota ISS</div><div style={valueStyle}>{ehMei ? 'Não se aplica (MEI)' : `${nfseConfig.aliquotaIss}%`}</div></div>
          <div style={{ padding: '0.6rem' }}><div style={labelStyle}>Valor Líquido</div><div style={valueStyle}>{valorFormatado}</div></div>
        </div>
      </div>

      {/* Tributação Municipal */}
      <div style={{ border: '1px solid #333', borderTop: 'none' }}>
        <div style={{ backgroundColor: '#f0f0f0', padding: '0.25rem 0.6rem', fontSize: '0.65rem', fontWeight: 'bold', textTransform: 'uppercase' }}>Tributação Municipal</div>
        <div style={{ padding: '0.6rem' }}>
          <div style={labelStyle}>Município da Prestação (Cód. IBGE)</div>
          <div style={{ marginBottom: '0.4rem' }}>{nfseConfig.codigoMunicipio}</div>
          <div style={labelStyle}>Regime de Tributação</div>
          <div>{REGIME_LABEL[nfseConfig.regimeTributario] || nfseConfig.regimeTributario}</div>
        </div>
      </div>

      {/* Rodapé: QR Code + chave de acesso */}
      <div style={{ border: '1px solid #333', borderTop: 'none', padding: '0.75rem', textAlign: 'center' }}>
        <div style={labelStyle}>Consulta pública / Autenticidade</div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrCodeDataUrl} alt="QR Code de consulta da NFS-e" style={{ width: '120px', height: '120px', margin: '0.5rem auto' }} />
        <p style={{ fontFamily: 'monospace', fontSize: '0.85rem', margin: '0.35rem 0' }}>{chaveFormatada}</p>
        <p className="text-muted" style={{ fontSize: '0.65rem', margin: 0 }}>
          Consulte a autenticidade em www.nfse.gov.br informando a chave de acesso acima.
        </p>
      </div>

      <div className="no-print" style={{ marginTop: '2rem', textAlign: 'center' }}>
        <PrintButton />
      </div>
    </div>
  )
}
