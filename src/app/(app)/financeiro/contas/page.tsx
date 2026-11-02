import { prisma } from "@/lib/prisma"
import { rotuloTipo, corTipo } from "@/lib/financeiro-tipos"
import Link from "next/link"
import { registrarPagamento, marcarComoPendente, deleteTransaction } from "../actions"
import BaixaPagamento from "@/components/BaixaPagamento"
import BotaoExcluir from "@/components/BotaoExcluir"
import { inicioDoDiaUTC, formatarDataUTC } from "@/lib/dates"
import type { Prisma } from "@prisma/client"

export const dynamic = 'force-dynamic'

const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

const STATUS: Record<string, { texto: string; classe: string }> = {
  PENDENTE: { texto: 'Em aberto', classe: 'badge badge-warning' },
  PAGO: { texto: 'Pago', classe: 'badge badge-success' },
  CANCELADO: { texto: 'Cancelado', classe: 'badge badge-neutral' },
}

type Filtros = { tipo?: string; status?: string; aberto?: string; mes?: string; ano?: string; q?: string; cat?: string }

/**
 * Lançamentos do Financeiro com filtros. "A receber"/"A pagar" (aberto=RECEITA|DESPESA) mostram
 * todas as contas em aberto por vencimento; nos demais casos a lista é do mês (ou do ano todo).
 */
export default async function ContasPage({ searchParams }: { searchParams: Promise<Filtros> }) {
  const f = await searchParams
  const hoje = inicioDoDiaUTC()
  const agora = new Date(Date.now() - 3 * 3600_000)
  const emAberto = f.aberto === 'RECEITA' || f.aberto === 'DESPESA' || f.aberto === 'todos'
  const ano = Number(f.ano) || agora.getUTCFullYear()
  const mes = f.mes === '0' ? 0 : Number(f.mes) || (f.ano ? 0 : agora.getUTCMonth() + 1)
  const periodo = mes ? { gte: new Date(Date.UTC(ano, mes - 1, 1)), lt: new Date(Date.UTC(ano, mes, 1)) } : { gte: new Date(Date.UTC(ano, 0, 1)), lt: new Date(Date.UTC(ano + 1, 0, 1)) }

  const where: Prisma.FinanceTransactionWhereInput = emAberto
    ? { status: 'PENDENTE', type: f.aberto === 'todos' ? { in: ['RECEITA', 'DESPESA'] } : f.aberto }
    : {
        ...(f.tipo ? { type: f.tipo } : {}),
        status: f.status ? f.status : { not: 'CANCELADO' },
        // Pago: pela data do pagamento; em aberto: pelo vencimento.
        OR: [{ status: 'PAGO', paidDate: periodo }, { status: { not: 'PAGO' }, dueDate: periodo }],
      }
  if (f.q) where.AND = [{ OR: [{ description: { contains: f.q, mode: 'insensitive' } }, { customer: { name: { contains: f.q, mode: 'insensitive' } } }, { notes: { contains: f.q, mode: 'insensitive' } }] }]
  if (f.cat) where.categoryId = f.cat === 'sem' ? null : f.cat

  const [transacoes, categorias] = await Promise.all([
    prisma.financeTransaction.findMany({
      where,
      orderBy: emAberto ? { dueDate: 'asc' } : [{ paidDate: 'desc' }, { dueDate: 'desc' }],
      include: { category: true, customer: true, supplier: true },
      take: 1000,
    }),
    prisma.financeCategory.findMany({ orderBy: { name: 'asc' } }),
  ])

  const entradas = transacoes.filter(t => t.type === 'RECEITA' && t.status !== 'CANCELADO').reduce((s, t) => s + t.amount, 0)
  const saidas = transacoes.filter(t => t.type === 'DESPESA' && t.status !== 'CANCELADO').reduce((s, t) => s + t.amount, 0)
  const outros = transacoes.filter(t => !['RECEITA', 'DESPESA'].includes(t.type)).length

  const link = (mudar: Partial<Filtros>) => {
    const q = new URLSearchParams()
    const final = { ...f, ...mudar }
    for (const [k, v] of Object.entries(final)) if (v !== undefined && v !== '') q.set(k, String(v))
    return `/financeiro/contas?${q.toString()}`
  }
  const titulo = f.aberto === 'RECEITA' ? 'A receber' : f.aberto === 'DESPESA' ? 'A pagar' : f.aberto === 'todos' ? 'Contas em aberto' : `Lançamentos — ${mes ? `${MESES[mes - 1]} de ${ano}` : ano}`

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-4" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
        <h3 style={{ margin: 0 }}>{titulo}</h3>
        <Link href="/financeiro/contas/novo" className="btn btn-primary">+ Novo lançamento</Link>
      </div>

      {/* Filtros */}
      <form method="get" className="card" style={{ padding: '0.9rem 1rem', marginBottom: '1rem' }}>
        {f.aberto && <input type="hidden" name="aberto" value={f.aberto} />}
        <div className="flex gap-4" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {!emAberto && (
            <>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label" htmlFor="mes">Mês</label>
                <select id="mes" name="mes" className="input-field" defaultValue={String(mes)} style={{ padding: '0.45rem 0.6rem' }}>
                  <option value="0">Ano todo</option>
                  {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label" htmlFor="ano">Ano</label>
                <input id="ano" name="ano" type="number" className="input-field" defaultValue={ano} style={{ width: 95, padding: '0.45rem 0.6rem' }} />
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label" htmlFor="tipo">Tipo</label>
                <select id="tipo" name="tipo" className="input-field" defaultValue={f.tipo || ''} style={{ padding: '0.45rem 0.6rem' }}>
                  <option value="">Todos</option>
                  <option value="RECEITA">Receitas</option>
                  <option value="DESPESA">Despesas</option>
                  <option value="APLICACAO">Aplicações</option>
                  <option value="RESGATE">Resgates</option>
                  <option value="APORTE">Aportes do sócio</option>
                  <option value="RETIRADA">Retiradas do sócio</option>
                </select>
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label" htmlFor="status">Situação</label>
                <select id="status" name="status" className="input-field" defaultValue={f.status || ''} style={{ padding: '0.45rem 0.6rem' }}>
                  <option value="">Pagos e em aberto</option>
                  <option value="PAGO">Pagos</option>
                  <option value="PENDENTE">Em aberto</option>
                  <option value="CANCELADO">Cancelados</option>
                </select>
              </div>
            </>
          )}
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label" htmlFor="cat">Categoria</label>
            <select id="cat" name="cat" className="input-field" defaultValue={f.cat || ''} style={{ padding: '0.45rem 0.6rem' }}>
              <option value="">Todas</option>
              {categorias.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              <option value="sem">Sem categoria</option>
            </select>
          </div>
          <div className="input-group" style={{ marginBottom: 0, flex: 1, minWidth: 180 }}>
            <label className="input-label" htmlFor="q">Buscar</label>
            <input id="q" name="q" className="input-field" defaultValue={f.q || ''} placeholder="Descrição, cliente, nº da nota…" style={{ padding: '0.45rem 0.6rem' }} />
          </div>
          <button type="submit" className="btn btn-primary">Filtrar</button>
          <Link href={emAberto ? `/financeiro/contas?aberto=${f.aberto}` : '/financeiro/contas'} className="text-muted" style={{ fontSize: '0.85rem' }}>Limpar</Link>
        </div>
      </form>

      {/* Totais do filtro */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
        <div className="card" style={{ padding: '0.75rem 1rem' }}><div className="stat-label">Entradas</div><strong style={{ color: 'var(--accent-green)', fontSize: '1.2rem' }}>{moeda(entradas)}</strong></div>
        <div className="card" style={{ padding: '0.75rem 1rem' }}><div className="stat-label">Saídas</div><strong style={{ color: 'var(--accent-red)', fontSize: '1.2rem' }}>{moeda(saidas)}</strong></div>
        <div className="card" style={{ padding: '0.75rem 1rem' }}><div className="stat-label">Saldo</div><strong style={{ fontSize: '1.2rem', color: entradas - saidas >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>{moeda(entradas - saidas)}</strong></div>
        <div className="card" style={{ padding: '0.75rem 1rem' }}><div className="stat-label">Lançamentos</div><strong style={{ fontSize: '1.2rem' }}>{transacoes.length}</strong>
          {outros > 0 && <div className="text-muted" style={{ fontSize: '0.72rem' }}>{outros} de investimento/sócio (fora do saldo)</div>}</div>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>{emAberto ? 'Vencimento' : 'Data'}</th>
              <th>Descrição</th>
              <th>Categoria</th>
              <th style={{ textAlign: 'right' }}>Valor</th>
              <th>Situação</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {transacoes.length === 0 && <tr><td colSpan={6} className="text-center text-muted">Nenhum lançamento encontrado.</td></tr>}
            {transacoes.map(t => {
              const atrasada = t.status === 'PENDENTE' && t.dueDate < hoje
              const data = t.status === 'PAGO' && t.paidDate ? t.paidDate : t.dueDate
              const sinal = t.type === 'RECEITA' || t.type === 'RESGATE' || t.type === 'APORTE' ? '+' : '−'
              const excluir = async () => { 'use server'; await deleteTransaction(t.id); return { ok: true } }
              return (
                <tr key={t.id} style={t.status === 'CANCELADO' ? { opacity: 0.55 } : undefined}>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {formatarDataUTC(data)}
                    {atrasada && <div style={{ color: 'var(--accent-red)', fontWeight: 600, fontSize: '0.7rem' }}>VENCIDA</div>}
                  </td>
                  <td>
                    <Link href={`/financeiro/contas/${t.id}`} className="text-primary">{t.description.length > 90 ? `${t.description.slice(0, 90)}…` : t.description}</Link>
                    <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                      {[t.customer?.name || t.supplier?.name, t.paymentMethod, !['RECEITA', 'DESPESA'].includes(t.type) ? rotuloTipo(t.type) : null].filter(Boolean).join(' · ')}
                    </div>
                  </td>
                  <td style={{ fontSize: '0.85rem' }}>
                    {t.category ? <Link href={link({ cat: t.category.id })} style={{ color: 'inherit' }}>{t.category.name}</Link> : <span className="text-muted">—</span>}
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 600, color: corTipo(t.type) }}>{sinal} {moeda(t.amount)}</td>
                  <td>
                    <span className={STATUS[t.status]?.classe || 'badge badge-neutral'}>{STATUS[t.status]?.texto || t.status}</span>
                  </td>
                  <td>
                    <div className="flex" style={{ gap: '0.75rem', alignItems: 'center', justifyContent: 'flex-end' }}>
                      {t.status === 'PENDENTE' && <BaixaPagamento action={registrarPagamento.bind(null, t.id)} tipo={t.type} formaAtual={t.paymentMethod} />}
                      {t.status === 'PAGO' && (
                        <form action={marcarComoPendente.bind(null, t.id)}>
                          <button type="submit" className="text-muted" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem' }}>Reabrir</button>
                        </form>
                      )}
                      <BotaoExcluir action={excluir} confirmar={`Excluir o lançamento "${t.description.slice(0, 60)}" de ${moeda(t.amount)}? Não dá para desfazer.`} />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {transacoes.length === 1000 && <p className="text-muted" style={{ fontSize: '0.8rem' }}>Mostrando os 1.000 primeiros. Use os filtros para refinar.</p>}
    </div>
  )
}
