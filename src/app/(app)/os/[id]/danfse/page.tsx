import { prisma } from "@/lib/prisma"
import { getCompanySettings, getNfseConfig } from "@/lib/settings"
import { notFound } from "next/navigation"
import { gerarCode128DataUrl } from "@/lib/barcode"
import PrintButton from "../imprimir/PrintButton"

export const dynamic = 'force-dynamic'

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

  const barcodeDataUrl = await gerarCode128DataUrl(emissao.chaveAcesso)
  const valor = os.price ? os.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'
  const chaveFormatada = emissao.chaveAcesso.match(/.{1,4}/g)?.join(' ') || emissao.chaveAcesso

  return (
    <div style={{ backgroundColor: 'white', color: 'black', padding: '2rem', maxWidth: '800px', margin: '0 auto', fontFamily: 'Arial, sans-serif', fontSize: '0.85rem' }}>
      {emissao.ambiente !== 'producao' && (
        <div style={{ textAlign: 'center', backgroundColor: '#fee2e2', color: '#991b1b', fontWeight: 'bold', padding: '0.5rem', marginBottom: '1rem', border: '1px solid #991b1b' }}>
          NFS-e EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO — SEM VALOR FISCAL
        </div>
      )}

      <div style={{ textAlign: 'center', borderBottom: '2px solid black', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
        {empresa.logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={empresa.logo} alt={empresa.name} style={{ height: '50px', width: '50px', objectFit: 'contain', margin: '0 auto 0.5rem' }} />
        )}
        <h1 style={{ margin: 0, fontSize: '1.25rem' }}>DANFSe</h1>
        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem' }}>Documento Auxiliar da Nota Fiscal de Serviço Eletrônica</p>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
        <tbody>
          <tr>
            <td style={{ border: '1px solid black', padding: '0.5rem', width: '50%' }}>
              <strong>Prestador:</strong> {empresa.name}<br />
              <strong>CNPJ:</strong> {empresa.document}<br />
              {empresa.address && <>{empresa.address}<br /></>}
              {empresa.phone && <>Tel: {empresa.phone}</>}
            </td>
            <td style={{ border: '1px solid black', padding: '0.5rem', width: '50%' }}>
              <strong>Tomador:</strong> {os.customer.name}<br />
              <strong>Documento:</strong> {os.customer.document || 'Não informado'}<br />
              {os.customer.address && <>{os.customer.address}</>}
            </td>
          </tr>
        </tbody>
      </table>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
        <tbody>
          <tr>
            <td style={{ border: '1px solid black', padding: '0.5rem' }}><strong>Número DPS:</strong> {emissao.numeroDps}</td>
            <td style={{ border: '1px solid black', padding: '0.5rem' }}><strong>Série:</strong> {emissao.serieDps}</td>
            <td style={{ border: '1px solid black', padding: '0.5rem' }}><strong>Data de Emissão:</strong> {emissao.createdAt.toLocaleDateString('pt-BR')}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ border: '1px solid black', padding: '0.5rem', marginBottom: '1rem' }}>
        <strong>Discriminação do Serviço:</strong>
        <p style={{ margin: '0.5rem 0 0 0' }}>{os.device} — {os.issue}</p>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
        <tbody>
          <tr>
            <td style={{ border: '1px solid black', padding: '0.5rem' }}><strong>Município (Cód. IBGE):</strong> {nfseConfig.codigoMunicipio}</td>
            <td style={{ border: '1px solid black', padding: '0.5rem' }}><strong>Regime Tributário:</strong> {nfseConfig.regimeTributario}</td>
            <td style={{ border: '1px solid black', padding: '0.5rem', textAlign: 'right' }}><strong>Valor Total:</strong> {valor}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ border: '1px solid black', padding: '0.75rem', textAlign: 'center' }}>
        <strong>Chave de Acesso</strong>
        <p style={{ fontFamily: 'monospace', fontSize: '0.9rem', margin: '0.35rem 0' }}>{chaveFormatada}</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={barcodeDataUrl} alt="Código de barras da chave de acesso" style={{ height: '50px', margin: '0.5rem auto' }} />
        <p className="text-muted" style={{ fontSize: '0.7rem', margin: 0 }}>
          Consulte a autenticidade em www.nfse.gov.br
        </p>
      </div>

      <div className="no-print" style={{ marginTop: '2rem', textAlign: 'center' }}>
        <PrintButton />
      </div>
    </div>
  )
}
