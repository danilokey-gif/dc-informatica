import { prisma } from "@/lib/prisma"
import { getNfseConfig, getNfeConfig, getCompanySettings } from "@/lib/settings"
import Link from "next/link"
import StatusBadge from "@/components/StatusBadge"
import SincronizarButton from "./SincronizarButton"
import SincronizarPeriodoButton from "./SincronizarPeriodoButton"
import { sincronizarNfseGoverno, sincronizarNfeGoverno } from "./sync-actions"

export const dynamic = 'force-dynamic'
// Dá mais tempo de execução (onde o plano da Vercel permitir) pras Server Actions de
// sincronização com o governo, que fazem varias chamadas HTTP sequenciais.
export const maxDuration = 60

function limitesDoMes(mes?: string) {
  if (!mes || !/^\d{4}-\d{2}$/.test(mes)) return undefined
  const inicio = new Date(`${mes}-01T00:00:00.000Z`)
  const fim = new Date(inicio.getFullYear(), inicio.getUTCMonth() + 1, 1)
  return { gte: inicio, lt: fim }
}

export default async function NotasFiscaisPage({ searchParams }: { searchParams: Promise<{ mesNfse?: string; mesNfe?: string }> }) {
  const { mesNfse, mesNfe } = await searchParams
  const filtroNfse = limitesDoMes(mesNfse)
  const filtroNfe = limitesDoMes(mesNfe)

  const [nfseConfig, nfeConfig, empresa, emissoesNfse, emissoesNfe] = await Promise.all([
    getNfseConfig(),
    getNfeConfig(),
    getCompanySettings(),
    prisma.nfseEmissao.findMany({
      where: filtroNfse ? { dataEmissao: filtroNfse } : undefined,
      include: { serviceOrder: { include: { customer: true } } },
      orderBy: { dataEmissao: 'desc' },
      take: filtroNfse ? undefined : 30,
    }),
    prisma.nfeEmissao.findMany({
      where: filtroNfe ? { dataEmissao: filtroNfe } : undefined,
      include: { sale: { include: { customer: true } } },
      orderBy: { dataEmissao: 'desc' },
      take: filtroNfe ? undefined : 30,
    }),
  ])

  const hoje = new Date().toISOString().slice(0, 10)
  const primeiroDiaMes = `${hoje.slice(0, 7)}-01`
  const mesAtual = hoje.slice(0, 7)

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
    dataExibida: Date
    clienteNome: string
    href: string
    importada: boolean
  }

  const linhasNfse: Linha[] = emissoesNfse.map(e => ({
    id: e.id,
    tipo: 'NFS-e' as const,
    numero: e.numeroDps,
    serie: e.serieDps,
    status: e.status,
    chaveAcesso: e.chaveAcesso,
    motivoErro: e.motivoErro,
    ambiente: e.ambiente,
    dataExibida: e.dataEmissao || e.createdAt,
    clienteNome: e.serviceOrder?.customer.name || e.tomadorNome || 'Não identificado',
    href: e.serviceOrderId ? `/os/${e.serviceOrderId}/imprimir` : `/notas-fiscais/xml?tipo=nfse&id=${e.id}`,
    importada: e.origem === 'IMPORTADA_GOVERNO',
  })).sort((a, b) => b.dataExibida.getTime() - a.dataExibida.getTime())

  const linhasNfe: Linha[] = emissoesNfe.map(e => ({
    id: e.id,
    tipo: 'NF-e' as const,
    numero: e.numero,
    serie: e.serie,
    status: e.status,
    chaveAcesso: e.chaveAcesso,
    motivoErro: e.motivoErro,
    ambiente: e.ambiente,
    dataExibida: e.dataEmissao || e.createdAt,
    clienteNome: e.sale?.customer?.name || e.destinatarioNome || 'Consumidor não identificado',
    href: e.saleId ? `/vendas/${e.saleId}/imprimir` : `/notas-fiscais/xml?tipo=nfe&id=${e.id}`,
    importada: e.origem === 'IMPORTADA_GOVERNO',
  })).sort((a, b) => b.dataExibida.getTime() - a.dataExibida.getTime())

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-4">
        <h2>Gerenciamento de Notas Fiscais</h2>
      </div>

      <p className="text-muted mb-4" style={{ fontSize: '0.9rem' }}>
        Acompanhe e configure as emissões de Notas Fiscais separadas por categoria de Serviço (NFS-e) e Venda de Produtos (NF-e).
      </p>

      {/* Configurações Rápidas */}
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
          <div className="flex gap-4" style={{ flexWrap: 'wrap' }}>
            <Link href="/configuracoes#nfse" className="btn btn-outline">Configurar NFS-e</Link>
          </div>
          {nfseConfigurada && (
            <div style={{ marginTop: '0.75rem' }}>
              <SincronizarButton tipo="NFS-e" action={sincronizarNfseGoverno} />
              <SincronizarPeriodoButton tipo="NFS-e" action={sincronizarNfseGoverno} />
            </div>
          )}
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
          <div className="flex gap-4" style={{ flexWrap: 'wrap' }}>
            <Link href="/configuracoes#nfe" className="btn btn-outline">Configurar NF-e</Link>
          </div>
          {nfeConfigurada && (
            <div style={{ marginTop: '0.75rem' }}>
              <SincronizarButton tipo="NF-e" action={sincronizarNfeGoverno} />
              <SincronizarPeriodoButton tipo="NF-e" action={sincronizarNfeGoverno} />
            </div>
          )}
        </div>
      </div>

      {/* Download do Período */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <h3 className="mb-4">⬇️ Baixar Notas do Período</h3>
        <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
          Baixa um arquivo .zip contendo todos os XMLs e PDFs de NFS-e e NF-e autorizados no período selecionado.
        </p>
        <form action="/notas-fiscais/download" method="get" className="flex gap-4" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label" htmlFor="inicio">De</label>
            <input type="date" id="inicio" name="inicio" className="input-field" defaultValue={primeiroDiaMes} required />
          </div>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label" htmlFor="fim">Até</label>
            <input type="date" id="fim" name="fim" className="input-field" defaultValue={hoje} required />
          </div>
          <button type="submit" className="btn btn-primary">Baixar .zip</button>
        </form>
      </div>

      {/* Lista Separada de Notas Fiscais */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

        {/* Seção 1: NFS-e */}
        <div className="card">
          <div className="flex justify-between items-center mb-4" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <h3 style={{ margin: 0 }}>🧾 Notas Fiscais de Serviços (NFS-e)</h3>
            <form method="get" className="flex gap-4" style={{ alignItems: 'center' }}>
              <input type="hidden" name="mesNfe" value={mesNfe || ''} />
              <input type="month" name="mesNfse" className="input-field" defaultValue={mesNfse || ''} style={{ padding: '0.35rem 0.6rem' }} max={mesAtual} />
              <button type="submit" className="btn btn-outline" style={{ padding: '0.35rem 0.75rem' }}>Filtrar</button>
              {mesNfse && <Link href={`/notas-fiscais${mesNfe ? `?mesNfe=${mesNfe}` : ''}`} className="text-muted" style={{ fontSize: '0.8rem' }}>Limpar</Link>}
            </form>
          </div>
          <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '-0.5rem', marginBottom: '0.75rem' }}>
            {mesNfse ? `Notas emitidas em ${mesNfse.split('-').reverse().join('/')}` : 'Últimas 30 emissões (sem filtro de período)'}
          </p>
          {linhasNfse.length === 0 ? (
            <p className="text-muted" style={{ fontSize: '0.9rem' }}>Nenhuma nota fiscal de serviço encontrada{mesNfse ? ' nesse período' : ' ainda'}.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                    <th style={{ padding: '0.5rem' }}>DPS / Série</th>
                    <th style={{ padding: '0.5rem' }}>Cliente</th>
                    <th style={{ padding: '0.5rem' }}>Origem</th>
                    <th style={{ padding: '0.5rem' }}>Ambiente</th>
                    <th style={{ padding: '0.5rem' }}>Status</th>
                    <th style={{ padding: '0.5rem' }}>Data de Emissão</th>
                    <th style={{ padding: '0.5rem' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {linhasNfse.map(linha => (
                    <tr key={linha.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>{linha.numero} / {linha.serie}</td>
                      <td style={{ padding: '0.5rem' }}>{linha.clienteNome}</td>
                      <td style={{ padding: '0.5rem' }}>
                        {linha.importada
                          ? <span className="badge badge-neutral">Importada</span>
                          : <span className="text-muted" style={{ fontSize: '0.8rem' }}>Sistema</span>}
                      </td>
                      <td style={{ padding: '0.5rem' }}>{linha.ambiente === 'producao' ? 'Produção' : 'Homologação'}</td>
                      <td style={{ padding: '0.5rem' }}>
                        <StatusBadge status={linha.status} />
                        {linha.motivoErro && (
                          <div className="text-muted" style={{ fontSize: '0.75rem', marginTop: '0.25rem', maxWidth: '260px' }}>{linha.motivoErro}</div>
                        )}
                      </td>
                      <td style={{ padding: '0.5rem', whiteSpace: 'nowrap' }}>{linha.dataExibida.toLocaleDateString('pt-BR')}</td>
                      <td style={{ padding: '0.5rem' }}>
                        <div className="flex gap-4">
                          <Link href={linha.href} className="text-muted" style={{ textDecoration: 'underline' }}>{linha.importada ? 'Baixar XML' : 'Gerenciar'}</Link>
                          {linha.chaveAcesso && (
                            <>
                              <Link href={`/notas-fiscais/ver-danfse?id=${linha.id}`} target="_blank" className="text-primary" style={{ textDecoration: 'underline' }}>Ver DANFSe</Link>
                              <Link href={`/notas-fiscais/ver-xml?tipo=nfse&id=${linha.id}`} className="text-muted" style={{ textDecoration: 'underline' }}>Ver XML</Link>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Seção 2: NF-e */}
        <div className="card">
          <div className="flex justify-between items-center mb-4" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <h3 style={{ margin: 0 }}>📦 Notas Fiscais de Produtos (NF-e)</h3>
            <form method="get" className="flex gap-4" style={{ alignItems: 'center' }}>
              <input type="hidden" name="mesNfse" value={mesNfse || ''} />
              <input type="month" name="mesNfe" className="input-field" defaultValue={mesNfe || ''} style={{ padding: '0.35rem 0.6rem' }} max={mesAtual} />
              <button type="submit" className="btn btn-outline" style={{ padding: '0.35rem 0.75rem' }}>Filtrar</button>
              {mesNfe && <Link href={`/notas-fiscais${mesNfse ? `?mesNfse=${mesNfse}` : ''}`} className="text-muted" style={{ fontSize: '0.8rem' }}>Limpar</Link>}
            </form>
          </div>
          <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '-0.5rem', marginBottom: '0.75rem' }}>
            {mesNfe ? `Notas emitidas em ${mesNfe.split('-').reverse().join('/')}` : 'Últimas 30 emissões (sem filtro de período)'}
          </p>
          {linhasNfe.length === 0 ? (
            <p className="text-muted" style={{ fontSize: '0.9rem' }}>Nenhuma nota fiscal de produto encontrada{mesNfe ? ' nesse período' : ' ainda'}.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                    <th style={{ padding: '0.5rem' }}>Nota / Série</th>
                    <th style={{ padding: '0.5rem' }}>Cliente</th>
                    <th style={{ padding: '0.5rem' }}>Origem</th>
                    <th style={{ padding: '0.5rem' }}>Ambiente</th>
                    <th style={{ padding: '0.5rem' }}>Status</th>
                    <th style={{ padding: '0.5rem' }}>Data de Emissão</th>
                    <th style={{ padding: '0.5rem' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {linhasNfe.map(linha => (
                    <tr key={linha.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>{linha.numero} / {linha.serie}</td>
                      <td style={{ padding: '0.5rem' }}>{linha.clienteNome}</td>
                      <td style={{ padding: '0.5rem' }}>
                        {linha.importada
                          ? <span className="badge badge-neutral">Importada</span>
                          : <span className="text-muted" style={{ fontSize: '0.8rem' }}>Sistema</span>}
                      </td>
                      <td style={{ padding: '0.5rem' }}>{linha.ambiente === 'producao' ? 'Produção' : 'Homologação'}</td>
                      <td style={{ padding: '0.5rem' }}>
                        <StatusBadge status={linha.status} />
                        {linha.motivoErro && (
                          <div className="text-muted" style={{ fontSize: '0.75rem', marginTop: '0.25rem', maxWidth: '260px' }}>{linha.motivoErro}</div>
                        )}
                      </td>
                      <td style={{ padding: '0.5rem', whiteSpace: 'nowrap' }}>{linha.dataExibida.toLocaleDateString('pt-BR')}</td>
                      <td style={{ padding: '0.5rem' }}>
                        <div className="flex gap-4">
                          <Link href={linha.href} className="text-muted" style={{ textDecoration: 'underline' }}>{linha.importada ? 'Baixar XML' : 'Gerenciar'}</Link>
                          {linha.chaveAcesso && (
                            <>
                              <Link href={`/notas-fiscais/ver-danfe?id=${linha.id}`} target="_blank" className="text-primary" style={{ textDecoration: 'underline' }}>Ver DANFE</Link>
                              <Link href={`/notas-fiscais/ver-xml?tipo=nfe&id=${linha.id}`} className="text-muted" style={{ textDecoration: 'underline' }}>Ver XML</Link>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
