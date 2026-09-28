import { prisma } from "@/lib/prisma"
import { getNfeConfig } from "@/lib/settings"
import Link from "next/link"
import BuscarFornecedoresButton from "./BuscarFornecedoresButton"

export const dynamic = 'force-dynamic'

function limitesDoMes(mes?: string) {
  if (!mes || !/^\d{4}-\d{2}$/.test(mes)) return undefined
  const inicio = new Date(`${mes}-01T00:00:00.000Z`)
  const fim = new Date(inicio)
  fim.setUTCMonth(fim.getUTCMonth() + 1)
  return { gte: inicio, lt: fim }
}

function formatarDocumento(doc: string | null): string {
  if (!doc) return '-'
  if (doc.length === 14) return doc.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  if (doc.length === 11) return doc.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  return doc
}

const SITUACAO: Record<string, { rotulo: string; classe: string }> = {
  '1': { rotulo: 'Autorizada', classe: 'badge-success' },
  '2': { rotulo: 'Denegada', classe: 'badge-warning' },
  '3': { rotulo: 'Cancelada', classe: 'badge-danger' },
}

const BRL = (valor: number) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default async function NotasFornecedoresPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes } = await searchParams
  const filtro = limitesDoMes(mes)
  const mesAtual = new Date().toISOString().slice(0, 7)

  const [nfeConfig, notas] = await Promise.all([
    getNfeConfig(),
    prisma.nfeRecebida.findMany({
      where: filtro ? { dataEmissao: filtro } : undefined,
      orderBy: { dataEmissao: 'desc' },
      take: filtro ? undefined : 100,
    }),
  ])

  const totalAutorizadas = notas.filter(n => n.situacao === '1').reduce((soma, n) => soma + (n.valorTotal || 0), 0)
  const certificadoOk = !!(nfeConfig.certificado && nfeConfig.certificadoSenha)

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-4" style={{ flexWrap: 'wrap', gap: '1rem' }}>
        <h2 style={{ margin: 0 }}>Notas de Fornecedores (NF-e recebidas)</h2>
        <div className="flex gap-4">
          <Link href="/notas-fiscais/importar-xml" className="btn btn-outline">Importar XML</Link>
          <Link href="/notas-fiscais" className="text-muted" style={{ alignSelf: 'center' }}>Voltar</Link>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '2rem', borderLeft: '4px solid var(--primary)' }}>
        <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
          Notas que <strong>outras empresas emitiram contra o CNPJ da Dc Informática</strong> (suas compras), buscadas na Sefaz
          pelo serviço de Distribuição DF-e. As notas que <strong>você emitiu</strong> não aparecem aqui: a Sefaz não devolve ao
          emitente as próprias notas. Para trazer vendas emitidas fora do sistema, use{' '}
          <Link href="/notas-fiscais/importar-xml" className="text-primary">Importar XML</Link>.
        </p>
        {certificadoOk
          ? <BuscarFornecedoresButton bloqueadoAte={nfeConfig.distDfeLiberadoEm?.toISOString() ?? null} />
          : (
            <p style={{ color: 'var(--accent-red)', fontSize: '0.875rem' }}>
              Configure o certificado digital em <Link href="/configuracoes#nfe" className="text-primary">Configurações</Link> para buscar notas.
            </p>
          )}
        <p className="text-muted" style={{ fontSize: '0.75rem', marginTop: '0.75rem' }}>
          Regra da Sefaz: quando não há mais notas novas, a próxima consulta só é permitida 1 hora depois. O sistema controla
          esse prazo sozinho e trava o botão até lá, para evitar o bloqueio de 1 hora (código 656).
          Notas marcadas como <em>Resumo</em> só têm os dados principais; a Sefaz libera o XML completo depois que o
          destinatário manifesta ciência da operação.
        </p>
      </div>

      <div className="card">
        <div className="flex justify-between items-center mb-4" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <h3 style={{ margin: 0 }}>🧾 Notas recebidas</h3>
          <form method="get" className="flex gap-4" style={{ alignItems: 'center' }}>
            <input type="month" name="mes" className="input-field" defaultValue={mes || ''} style={{ padding: '0.35rem 0.6rem' }} max={mesAtual} />
            <button type="submit" className="btn btn-outline" style={{ padding: '0.35rem 0.75rem' }}>Filtrar</button>
            {mes && <Link href="/notas-fiscais/fornecedores" className="text-muted" style={{ fontSize: '0.8rem' }}>Limpar</Link>}
          </form>
        </div>
        <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '-0.5rem', marginBottom: '0.75rem' }}>
          {mes ? `Notas emitidas em ${mes.split('-').reverse().join('/')}` : 'Últimas 100 notas (sem filtro de período)'}
          {notas.length > 0 && <> — total autorizado: <strong>{BRL(totalAutorizadas)}</strong></>}
        </p>

        {notas.length === 0 ? (
          <p className="text-muted" style={{ fontSize: '0.9rem' }}>Nenhuma nota de fornecedor{mes ? ' nesse período' : ' ainda'}.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                  <th style={{ padding: '0.5rem' }}>Data</th>
                  <th style={{ padding: '0.5rem' }}>Fornecedor</th>
                  <th style={{ padding: '0.5rem' }}>Nota / Série</th>
                  <th style={{ padding: '0.5rem', textAlign: 'right' }}>Valor</th>
                  <th style={{ padding: '0.5rem' }}>Situação</th>
                  <th style={{ padding: '0.5rem' }}>Conteúdo</th>
                  <th style={{ padding: '0.5rem' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {notas.map(n => {
                  const situacao = SITUACAO[n.situacao] || { rotulo: n.situacao, classe: 'badge-neutral' }
                  return (
                    <tr key={n.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.5rem', whiteSpace: 'nowrap' }}>
                        {n.dataEmissao ? n.dataEmissao.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '-'}
                      </td>
                      <td style={{ padding: '0.5rem' }}>
                        <div>{n.emitenteNome || 'Não identificado'}</div>
                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>{formatarDocumento(n.emitenteCnpj)}</div>
                      </td>
                      <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>{n.numero ?? '-'} / {n.serie ?? '-'}</td>
                      <td style={{ padding: '0.5rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {n.valorTotal != null ? BRL(n.valorTotal) : '-'}
                      </td>
                      <td style={{ padding: '0.5rem' }}>
                        <span className={`badge ${situacao.classe}`}>{situacao.rotulo}</span>
                      </td>
                      <td style={{ padding: '0.5rem' }}>
                        {n.completa
                          ? <span className="text-muted" style={{ fontSize: '0.8rem' }}>XML completo</span>
                          : <span className="badge badge-neutral">Resumo</span>}
                      </td>
                      <td style={{ padding: '0.5rem' }}>
                        <div className="flex gap-4">
                          {n.completa && (
                            <Link href={`/notas-fiscais/ver-danfe?id=${n.id}&origem=recebida`} target="_blank" className="text-primary" style={{ textDecoration: 'underline' }}>
                              Ver DANFE
                            </Link>
                          )}
                          <Link href={`/notas-fiscais/ver-xml?tipo=nfe-recebida&id=${n.id}`} className="text-muted" style={{ textDecoration: 'underline' }}>
                            Ver XML
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
