import { prisma } from "@/lib/prisma"
import { getNfseConfig, getNfeConfig, getCompanySettings } from "@/lib/settings"
import Link from "next/link"
import StatusBadge from "@/components/StatusBadge"
import SincronizarButton from "./SincronizarButton"
import SincronizarPeriodoButton from "./SincronizarPeriodoButton"
import { sincronizarNfseGoverno } from "./sync-actions"

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
    importada: e.origem !== 'SISTEMA',
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
    importada: e.origem !== 'SISTEMA',
  })).sort((a, b) => b.dataExibida.getTime() - a.dataExibida.getTime())

  const ambienteLabel = (a: string) => (a === 'producao' ? 'Produção' : 'Homologação')

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-4" style={{ flexWrap: 'wrap', gap: '1rem' }}>
        <h2 style={{ margin: 0 }}>Notas Emitidas</h2>
        <div className="flex gap-4" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
          <Link href="/notas-fiscais/emitir" className="btn btn-primary">+ Emitir Nota</Link>
          <Link href="/notas-fiscais/importar-xml" className="btn btn-outline">📥 Importar XML</Link>
          <Link href="/configuracoes#nfse" className="text-muted" style={{ fontSize: '0.85rem' }}>⚙️ Configurações fiscais</Link>
        </div>
      </div>

      {/* Situação da configuração de cada tipo de nota, numa linha só */}
      <div className="flex gap-4" style={{ flexWrap: 'wrap', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
        <span>
          🧾 NFS-e (serviço): {nfseConfigurada
            ? <span className="badge badge-success">Pronta · {ambienteLabel(nfseConfig.ambiente)}</span>
            : <Link href="/configuracoes#nfse" className="badge badge-warning">Configuração incompleta</Link>}
        </span>
        <span>
          📦 NF-e (produto): {nfeConfigurada
            ? <span className="badge badge-success">Pronta · {ambienteLabel(nfeConfig.ambiente)}</span>
            : <Link href="/configuracoes#nfe" className="badge badge-warning">Configuração incompleta</Link>}
        </span>
      </div>

      {/* Baixar Notas do Período */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="flex justify-between items-center" style={{ flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 style={{ margin: 0 }}>⬇️ Baixar notas do período</h3>
            <p className="text-muted" style={{ fontSize: '0.8rem', margin: '0.25rem 0 0' }}>Um .zip com os XMLs e PDFs das NFS-e e NF-e autorizadas.</p>
          </div>
          <form action="/notas-fiscais/download" method="get" className="flex gap-4" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label" htmlFor="inicio">De</label>
              <input type="date" id="inicio" name="inicio" className="input-field" defaultValue={primeiroDiaMes} required />
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label" htmlFor="fim">Até</label>
              <input type="date" id="fim" name="fim" className="input-field" defaultValue={hoje} required />
            </div>
            <button type="submit" className="btn btn-outline">Baixar .zip</button>
          </form>
        </div>
      </div>

      {/* Busca de NFS-e no governo: usada de vez em quando, então fica recolhida */}
      {nfseConfigurada && (
        <details className="card" style={{ marginBottom: '1.5rem' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>🔄 Trazer NFS-e emitidas no portal do governo</summary>
          <p className="text-muted" style={{ fontSize: '0.8rem', margin: '0.75rem 0' }}>
            Para notas de serviço que você emitiu direto no emissor nacional, fora do sistema.
          </p>
          <SincronizarButton tipo="NFS-e" action={sincronizarNfseGoverno} />
          <SincronizarPeriodoButton tipo="NFS-e" action={sincronizarNfseGoverno} />
        </details>
      )}

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
