import { prisma } from "@/lib/prisma"
import { getNfseConfig, getNfeConfig, getCompanySettings } from "@/lib/settings"
import Link from "next/link"
import StatusBadge from "@/components/StatusBadge"

export const dynamic = 'force-dynamic'

export default async function NotasFiscaisPage() {
  const [nfseConfig, nfeConfig, empresa, emissoesNfse, emissoesNfe] = await Promise.all([
    getNfseConfig(),
    getNfeConfig(),
    getCompanySettings(),
    prisma.nfseEmissao.findMany({
      include: { serviceOrder: { include: { customer: true } } },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
    prisma.nfeEmissao.findMany({
      include: { sale: { include: { customer: true } } },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
  ])

  const nfseConfigurada = !!(nfseConfig.certificado && nfseConfig.codigoMunicipio && nfseConfig.codigoServico && nfseConfig.aliquotaIss !== null)
  const nfeConfigurada = !!(nfeConfig.certificado && empresa.inscricaoEstadual && empresa.enderLogradouro && nfeConfig.codigoMunicipio)

  type Linha = {
    id: string
    tipo: 'NFS-e' | 'NF-e'
    numero: number
    serie: string
    status: string
    chaveAcesso: string | null
    motivoErro: string | null
    ambiente: string
    createdAt: Date
    clienteNome: string
    href: string
  }

  const linhasNfse: Linha[] = emissoesNfse.map(e => ({
    id: e.id,
    tipo: 'NFS-e',
    numero: e.numeroDps,
    serie: e.serieDps,
    status: e.status,
    chaveAcesso: e.chaveAcesso,
    motivoErro: e.motivoErro,
    ambiente: e.ambiente,
    createdAt: e.createdAt,
    clienteNome: e.serviceOrder.customer.name,
    href: `/os/${e.serviceOrderId}/imprimir`,
  }))

  const linhasNfe: Linha[] = emissoesNfe.map(e => ({
    id: e.id,
    tipo: 'NF-e',
    numero: e.numero,
    serie: e.serie,
    status: e.status,
    chaveAcesso: e.chaveAcesso,
    motivoErro: e.motivoErro,
    ambiente: e.ambiente,
    createdAt: e.createdAt,
    clienteNome: e.sale.customer?.name || 'Consumidor não identificado',
    href: `/vendas/${e.saleId}/imprimir`,
  }))

  const todasEmissoes = [...linhasNfse, ...linhasNfe].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-4">
        <h2>Notas Fiscais</h2>
      </div>

      <p className="text-muted mb-4" style={{ fontSize: '0.9rem' }}>
        Emita a NFS-e direto na Ordem de Serviço (aba &quot;Imprimir&quot;) e a NF-e direto na Venda (aba &quot;Imprimir&quot;). Aqui você acompanha o status de tudo o que já foi emitido.
      </p>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div className="card" style={{ borderLeft: '4px solid #dc2626' }}>
          <div className="flex justify-between items-center mb-2">
            <h3 style={{ margin: 0 }}>🧾 Nota Fiscal de Serviço</h3>
            {nfseConfigurada
              ? <span className="badge badge-success">Configurada</span>
              : <span className="badge badge-warning">Incompleta</span>}
          </div>
          <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
            NFS-e Nacional para Ordens de Serviço concluídas. Ambiente atual: <strong>{nfseConfig.ambiente === 'producao' ? 'Produção' : 'Homologação'}</strong>.
          </p>
          <Link href="/configuracoes#nfse" className="btn btn-outline">Configurar NFS-e</Link>
        </div>

        <div className="card" style={{ borderLeft: '4px solid #dc2626' }}>
          <div className="flex justify-between items-center mb-2">
            <h3 style={{ margin: 0 }}>📦 Nota Fiscal de Produtos</h3>
            {nfeConfigurada
              ? <span className="badge badge-success">Configurada</span>
              : <span className="badge badge-warning">Incompleta</span>}
          </div>
          <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
            NF-e para vendas de produtos. Ambiente atual: <strong>{nfeConfig.ambiente === 'producao' ? 'Produção' : 'Homologação'}</strong>.
          </p>
          <Link href="/configuracoes#nfe" className="btn btn-outline">Configurar NF-e</Link>
        </div>
      </div>

      <div className="card">
        <h3 className="mb-4">Emissões Recentes</h3>
        {todasEmissoes.length === 0 ? (
          <p className="text-muted" style={{ fontSize: '0.9rem' }}>Nenhuma nota fiscal emitida ainda pelo sistema.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                  <th style={{ padding: '0.5rem' }}>Tipo</th>
                  <th style={{ padding: '0.5rem' }}>Nº / Série</th>
                  <th style={{ padding: '0.5rem' }}>Cliente</th>
                  <th style={{ padding: '0.5rem' }}>Ambiente</th>
                  <th style={{ padding: '0.5rem' }}>Status</th>
                  <th style={{ padding: '0.5rem' }}>Data</th>
                  <th style={{ padding: '0.5rem' }}></th>
                </tr>
              </thead>
              <tbody>
                {todasEmissoes.map(linha => (
                  <tr key={`${linha.tipo}-${linha.id}`} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.5rem' }}>{linha.tipo}</td>
                    <td style={{ padding: '0.5rem' }}>{linha.numero} / {linha.serie}</td>
                    <td style={{ padding: '0.5rem' }}>{linha.clienteNome}</td>
                    <td style={{ padding: '0.5rem' }}>{linha.ambiente === 'producao' ? 'Produção' : 'Homologação'}</td>
                    <td style={{ padding: '0.5rem' }}>
                      <StatusBadge status={linha.status} />
                      {linha.motivoErro && (
                        <div className="text-muted" style={{ fontSize: '0.75rem', marginTop: '0.25rem', maxWidth: '260px' }}>{linha.motivoErro}</div>
                      )}
                    </td>
                    <td style={{ padding: '0.5rem', whiteSpace: 'nowrap' }}>{linha.createdAt.toLocaleDateString('pt-BR')}</td>
                    <td style={{ padding: '0.5rem' }}>
                      <Link href={linha.href} className="text-muted" style={{ textDecoration: 'underline' }}>Ver</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
