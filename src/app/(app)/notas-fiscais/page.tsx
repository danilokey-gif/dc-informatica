import { prisma } from "@/lib/prisma"
import { getNfseConfig, getNfeConfig, getCompanySettings } from "@/lib/settings"
import Link from "next/link"
import StatusBadge from "@/components/StatusBadge"
import SincronizarButton from "./SincronizarButton"
import SincronizarPeriodoButton from "./SincronizarPeriodoButton"
import { sincronizarNfseGoverno } from "./sync-actions"
import { notasDoAno, resumoDoAno, MESES, type Aba, type LinhaNota } from "./notas-do-ano"
import BotaoWhatsAppNota from "@/components/BotaoWhatsAppNota"
import { montarEnvioWhatsApp, origemDoSite, telefonesPorDocumento } from "@/lib/nota-whatsapp"

export const dynamic = 'force-dynamic'
// Dá mais tempo de execução (onde o plano da Vercel permitir) pras Server Actions de
// sincronização com o governo, que fazem varias chamadas HTTP sequenciais.
export const maxDuration = 60

const ABAS: { id: Aba; rotulo: string }[] = [
  { id: 'resumo', rotulo: '📊 Resumo' },
  { id: 'servico', rotulo: '🧾 Serviço (NFS-e)' },
  { id: 'produto', rotulo: '📦 Produto (NF-e)' },
  { id: 'devolucao', rotulo: '↩️ Devoluções' },
  { id: 'testes', rotulo: '🧪 Testes e recusadas' },
]

const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dataBr = (d: Date) => d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })

/**
 * Notas emitidas, organizadas por ano: Resumo (totais por mês) e uma aba para cada tipo.
 * Os totais contam só notas de PRODUÇÃO autorizadas; canceladas aparecem à parte e não somam.
 */
export default async function NotasFiscaisPage({ searchParams }: { searchParams: Promise<{ ano?: string; aba?: string; mes?: string }> }) {
  const params = await searchParams
  const anoAtual = Number(new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 4))
  const ano = /^\d{4}$/.test(params.ano || '') ? Number(params.ano) : anoAtual
  const aba: Aba = ABAS.some(a => a.id === params.aba) ? (params.aba as Aba) : 'resumo'
  const mes = params.mes && /^(0?[1-9]|1[0-2])$/.test(params.mes) ? Number(params.mes) : null

  const [nfseConfig, nfeConfig, empresa, todas, anosComNota] = await Promise.all([
    getNfseConfig(),
    getNfeConfig(),
    getCompanySettings(),
    notasDoAno(ano),
    prisma.$queryRaw<{ ano: number }[]>`
      SELECT DISTINCT EXTRACT(YEAR FROM ("dataEmissao" - INTERVAL '3 hours'))::int AS ano FROM "NfseEmissao" WHERE "dataEmissao" IS NOT NULL
      UNION SELECT DISTINCT EXTRACT(YEAR FROM ("dataEmissao" - INTERVAL '3 hours'))::int FROM "NfeEmissao" WHERE "dataEmissao" IS NOT NULL
      ORDER BY 1 DESC`,
  ])
  const anos = [...new Set([anoAtual, ...anosComNota.map(a => a.ano)])].sort((a, b) => b - a)
  const resumo = resumoDoAno(todas)

  const nfseConfigurada = !!(nfseConfig.certificado && nfseConfig.codigoMunicipio && nfseConfig.codigoServico && nfseConfig.aliquotaIss !== null)
  const nfeConfigurada = !!(nfeConfig.certificado && empresa.inscricaoEstadual && empresa.enderLogradouro && nfeConfig.codigoMunicipio)
  const ambienteLabel = (a: string) => (a === 'producao' ? 'Produção' : 'Homologação')

  const linhasDaAba = todas
    .filter(l => (aba === 'testes' ? l.grupo === 'teste' : l.grupo === aba))
    .filter(l => !mes || l.mes === mes)
  const autorizadas = linhasDaAba.filter(l => l.status === 'AUTORIZADA')
  const totalAba = autorizadas.reduce((s, l) => s + l.valor, 0)
  const canceladasAba = linhasDaAba.filter(l => l.status === 'CANCELADA')

  const link = (p: { ano?: number; aba?: Aba; mes?: number | null }) => {
    const q = new URLSearchParams()
    q.set('ano', String(p.ano ?? ano))
    const a = p.aba ?? aba
    if (a !== 'resumo') q.set('aba', a)
    const m = p.mes === undefined ? mes : p.mes
    if (m) q.set('mes', String(m))
    return `/notas-fiscais?${q.toString()}`
  }

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-4" style={{ flexWrap: 'wrap', gap: '1rem' }}>
        <h2 style={{ margin: 0 }}>Notas Emitidas</h2>
        <div className="flex gap-4" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
          <Link href="/notas-fiscais/emitir" className="btn btn-primary">+ Emitir Nota</Link>
          <Link href="/notas-fiscais/devolucao" className="btn btn-outline">↩️ Nota de Devolução</Link>
          <Link href="/notas-fiscais/importar-xml" className="btn btn-outline">📥 Importar XML</Link>
        </div>
      </div>

      <div className="flex gap-4" style={{ flexWrap: 'wrap', marginBottom: '1rem', fontSize: '0.85rem', alignItems: 'center' }}>
        <span>🧾 NFS-e: {nfseConfigurada
          ? <span className="badge badge-success">Pronta · {ambienteLabel(nfseConfig.ambiente)}</span>
          : <Link href="/configuracoes#nfse" className="badge badge-warning">Configuração incompleta</Link>}</span>
        <span>📦 NF-e: {nfeConfigurada
          ? <span className="badge badge-success">Pronta · {ambienteLabel(nfeConfig.ambiente)}</span>
          : <Link href="/configuracoes#nfe" className="badge badge-warning">Configuração incompleta</Link>}</span>
        <Link href="/configuracoes#nfse" className="text-muted">⚙️ Configurações fiscais</Link>
      </div>

      {/* Ano */}
      <div className="flex gap-4" style={{ alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
        <strong>Ano:</strong>
        <div className="flex" style={{ gap: '0.4rem', flexWrap: 'wrap' }}>
          {anos.map(a => (
            <Link key={a} href={link({ ano: a, mes: null })} className={a === ano ? 'btn btn-primary' : 'btn btn-outline'} style={{ padding: '0.3rem 0.85rem' }}>{a}</Link>
          ))}
        </div>
      </div>

      {/* Abas */}
      <div className="abas-notas" role="tablist">
        {ABAS.map(a => {
          const qtd = a.id === 'resumo' ? null : todas.filter(l => (a.id === 'testes' ? l.grupo === 'teste' : l.grupo === a.id)).length
          return (
            <Link key={a.id} role="tab" aria-selected={a.id === aba} href={link({ aba: a.id, mes: null })} className={`aba-nota${a.id === aba ? ' ativa' : ''}`}>
              {a.rotulo}{qtd !== null && <span className="aba-nota-qtd">{qtd}</span>}
            </Link>
          )
        })}
      </div>

      {aba === 'resumo' ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="card">
              <div className="stat-label">Serviço (NFS-e)</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{moeda(resumo.servico.valor)}</div>
              <div className="text-muted" style={{ fontSize: '0.85rem' }}>{resumo.servico.qtd} nota(s){resumo.servico.canceladas > 0 && ` · ${resumo.servico.canceladas} cancelada(s) fora do total`}</div>
            </div>
            <div className="card">
              <div className="stat-label">Produto (NF-e)</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{moeda(resumo.produto.valor)}</div>
              <div className="text-muted" style={{ fontSize: '0.85rem' }}>{resumo.produto.qtd} nota(s){resumo.produto.canceladas > 0 && ` · ${resumo.produto.canceladas} cancelada(s) fora do total`}</div>
            </div>
            <div className="card">
              <div className="stat-label">Devoluções de venda</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{resumo.devolucaoVenda.valor > 0 ? `− ${moeda(resumo.devolucaoVenda.valor)}` : moeda(0)}</div>
              <div className="text-muted" style={{ fontSize: '0.85rem' }}>{resumo.devolucaoVenda.qtd} nota(s) · descontadas do total</div>
            </div>
            <div className="card" style={{ borderColor: 'var(--primary)' }}>
              <div className="stat-label">Total emitido em {ano}</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--primary)' }}>{moeda(resumo.total)}</div>
              <div className="text-muted" style={{ fontSize: '0.85rem' }}>Serviço + produto − devoluções de venda</div>
            </div>
          </div>

          <div className="card">
            <div className="flex justify-between items-center mb-4" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
              <h3 style={{ margin: 0 }}>Mês a mês — {ano}</h3>
              <a href={`/notas-fiscais/exportar?ano=${ano}`} className="btn btn-outline" style={{ padding: '0.35rem 0.9rem' }}>⬇️ Planilha do ano (Excel)</a>
            </div>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr><th>Mês</th><th style={{ textAlign: 'right' }}>Serviço (NFS-e)</th><th style={{ textAlign: 'right' }}>Produto (NF-e)</th><th style={{ textAlign: 'right' }}>Devoluções</th><th style={{ textAlign: 'right' }}>Total do mês</th></tr>
                </thead>
                <tbody>
                  {resumo.meses.map(m => (
                    <tr key={m.mes} style={m.total === 0 && m.qtdServico + m.qtdProduto === 0 ? { opacity: 0.55 } : undefined}>
                      <td>{MESES[m.mes - 1]}</td>
                      <td style={{ textAlign: 'right' }}>
                        {m.qtdServico > 0 ? <Link href={link({ aba: 'servico', mes: m.mes })} className="text-primary">{moeda(m.servico)}</Link> : '—'}
                        {m.qtdServico > 0 && <div className="text-muted" style={{ fontSize: '0.75rem' }}>{m.qtdServico} nota(s)</div>}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {m.qtdProduto > 0 ? <Link href={link({ aba: 'produto', mes: m.mes })} className="text-primary">{moeda(m.produto)}</Link> : '—'}
                        {m.qtdProduto > 0 && <div className="text-muted" style={{ fontSize: '0.75rem' }}>{m.qtdProduto} nota(s)</div>}
                      </td>
                      <td style={{ textAlign: 'right' }}>{m.devolucao > 0 ? `− ${moeda(m.devolucao)}` : '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{m.total !== 0 ? moeda(m.total) : '—'}</td>
                    </tr>
                  ))}
                  <tr style={{ fontWeight: 700, background: 'var(--surface-hover)' }}>
                    <td>Total {ano}</td>
                    <td style={{ textAlign: 'right' }}>{moeda(resumo.servico.valor)}</td>
                    <td style={{ textAlign: 'right' }}>{moeda(resumo.produto.valor)}</td>
                    <td style={{ textAlign: 'right' }}>{resumo.devolucaoVenda.valor > 0 ? `− ${moeda(resumo.devolucaoVenda.valor)}` : '—'}</td>
                    <td style={{ textAlign: 'right', color: 'var(--primary)' }}>{moeda(resumo.total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.75rem' }}>
              Contam só notas reais (produção) autorizadas, pela data de emissão. Notas canceladas, de teste (homologação) e recusadas
              não entram nos totais. Devolução de compra (ao fornecedor) não é faturamento e fica fora da conta.
            </p>
          </div>
        </>
      ) : (
        <div className="card">
          <div className="flex justify-between items-center mb-4" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ margin: 0 }}>{ABAS.find(a => a.id === aba)!.rotulo} — {mes ? `${MESES[mes - 1]}/${ano}` : ano}</h3>
              {aba !== 'testes' && (
                <p style={{ margin: '0.25rem 0 0' }}>
                  <strong>{autorizadas.length} autorizada(s) · {moeda(totalAba)}</strong>
                  {canceladasAba.length > 0 && <span className="text-muted"> · {canceladasAba.length} cancelada(s) ({moeda(canceladasAba.reduce((s, l) => s + l.valor, 0))}) fora do total</span>}
                </p>
              )}
            </div>
            <div className="flex gap-4" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="flex" style={{ gap: '0.3rem', flexWrap: 'wrap' }}>
                <Link href={link({ mes: null })} className={!mes ? 'badge badge-success' : 'badge badge-neutral'}>Ano todo</Link>
                {MESES.map((nome, i) => (
                  <Link key={nome} href={link({ mes: i + 1 })} className={mes === i + 1 ? 'badge badge-success' : 'badge badge-neutral'}>{nome.slice(0, 3)}</Link>
                ))}
              </div>
              {aba !== 'testes' && <a href={`/notas-fiscais/exportar?ano=${ano}&aba=${aba}${mes ? `&mes=${mes}` : ''}`} className="btn btn-outline" style={{ padding: '0.35rem 0.9rem' }}>⬇️ Excel</a>}
            </div>
          </div>

          {linhasDaAba.length === 0 ? (
            <p className="text-muted">Nenhuma nota {mes ? 'neste mês' : 'neste ano'}.</p>
          ) : (
            <TabelaNotas linhas={linhasDaAba} mostrarAmbiente={aba === 'testes'} telefones={await telefonesPorDocumento()} origem={await origemDoSite()} empresa={empresa.nomeFantasia || empresa.name} />
          )}
        </div>
      )}

      {/* Ferramentas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem', marginTop: '1.5rem' }}>
        <div className="card">
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>⬇️ Baixar XMLs e PDFs do período</h3>
          <p className="text-muted" style={{ fontSize: '0.8rem', margin: '0.25rem 0 0.75rem' }}>Um .zip com as NFS-e e NF-e autorizadas (para o contador).</p>
          <form action="/notas-fiscais/download" method="get" className="flex gap-4" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label" htmlFor="inicio">De</label>
              <input type="date" id="inicio" name="inicio" className="input-field" defaultValue={`${ano}-${String(mes ?? 1).padStart(2, '0')}-01`} required />
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label" htmlFor="fim">Até</label>
              <input type="date" id="fim" name="fim" className="input-field" defaultValue={mes ? new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10) : `${ano}-12-31`} required />
            </div>
            <button type="submit" className="btn btn-outline">Baixar .zip</button>
          </form>
        </div>
        {nfseConfigurada && (
          <details className="card">
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>🔄 Trazer NFS-e emitidas no portal do governo</summary>
            <p className="text-muted" style={{ fontSize: '0.8rem', margin: '0.75rem 0' }}>
              Traz as notas de serviço emitidas direto no emissor nacional e os cancelamentos feitos lá.
            </p>
            <SincronizarButton tipo="NFS-e" action={sincronizarNfseGoverno} />
            <SincronizarPeriodoButton tipo="NFS-e" action={sincronizarNfseGoverno} />
          </details>
        )}
      </div>
    </div>
  )
}

function TabelaNotas({ linhas, mostrarAmbiente, telefones, origem, empresa }: { linhas: LinhaNota[]; mostrarAmbiente: boolean; telefones: Map<string, string>; origem: string; empresa: string }) {
  // Envio por WhatsApp: só notas de verdade (produção, autorizadas), com o telefone do cadastro do cliente.
  const whatsapp = (l: LinhaNota) => {
    if (l.grupo === 'teste' || l.status !== 'AUTORIZADA' || !l.linkPdf) return null
    const tipo = l.tipoNota === 'NFS-e' ? 'nfse' as const : 'nfe' as const
    const envio = montarEnvioWhatsApp({ tipo, id: l.id, numero: l.numero, valor: l.valor || null, empresa, origem, telefone: telefones.get((l.documento || '').replace(/\D/g, '')) || null })
    return { ...envio, urlPdf: `/notas-fiscais/${tipo === 'nfse' ? 'danfse' : 'danfe'}-pdf?id=${l.id}`, nomeArquivo: `${l.tipoNota}-${l.numero}.pdf` }
  }
  return (
    <div className="table-container">
      <table className="table">
        <thead>
          <tr>
            <th>Data</th><th>Nº</th><th>Cliente / destinatário</th><th style={{ textAlign: 'right' }}>Valor</th><th>Situação</th><th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map(l => (
            <tr key={l.id} style={l.status === 'CANCELADA' ? { opacity: 0.6 } : undefined}>
              <td style={{ whiteSpace: 'nowrap' }}>{dataBr(l.data)}</td>
              <td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
                {l.numero}{l.serie && <span className="text-muted" style={{ fontWeight: 400 }}> / {l.serie}</span>}
                <div className="text-muted" style={{ fontSize: '0.72rem', fontWeight: 400 }}>{l.tipoNota}{l.importada ? ' · importada' : ''}</div>
              </td>
              <td>{l.cliente}{l.documento && <div className="text-muted" style={{ fontSize: '0.75rem' }}>{l.documento}</div>}</td>
              <td style={{ textAlign: 'right', whiteSpace: 'nowrap', textDecoration: l.status === 'CANCELADA' ? 'line-through' : undefined }}>{l.valor ? moeda(l.valor) : '—'}</td>
              <td>
                <StatusBadge status={l.status} />
                {mostrarAmbiente && <div className="text-muted" style={{ fontSize: '0.75rem' }}>{l.ambiente === 'producao' ? 'Produção' : 'Homologação (teste)'}</div>}
                {l.observacao && <div className="text-muted" style={{ fontSize: '0.75rem', maxWidth: 280 }}>{l.observacao}</div>}
              </td>
              <td>
                <div className="flex" style={{ gap: '0.75rem', flexWrap: 'wrap' }}>
                  {l.linkPdf && <Link href={l.linkPdf} className="text-primary" style={{ textDecoration: 'underline' }}>{l.tipoNota === 'NFS-e' ? 'DANFSe' : 'DANFE'}</Link>}
                  {l.linkXml && <Link href={l.linkXml} className="text-muted" style={{ textDecoration: 'underline' }}>XML</Link>}
                  {(w => w && <BotaoWhatsAppNota {...w} compacto />)(whatsapp(l))}
                  {l.linkOrigem && <Link href={l.linkOrigem} className="text-muted" style={{ textDecoration: 'underline' }}>{l.rotuloOrigem}</Link>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
