import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { inicioDoDiaUTC, formatarDataUTC } from "@/lib/dates"
import { registrarPagamento } from "./actions"
import BaixaPagamento from "@/components/BaixaPagamento"

export const dynamic = 'force-dynamic'

const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const inicioMes = (ano: number, mes: number) => new Date(Date.UTC(ano, mes - 1, 1))

/**
 * Visão geral do Financeiro: resultado do mês (só receitas e despesas pagas; aplicações e
 * movimentos do sócio ficam de fora), contas em aberto, evolução de 12 meses e categorias.
 */
export default async function FinanceiroPage({ searchParams }: { searchParams: Promise<{ mes?: string; ano?: string }> }) {
  const params = await searchParams
  const hoje = inicioDoDiaUTC()
  const agora = new Date(Date.now() - 3 * 3600_000)
  const mes = Number(params.mes) || agora.getUTCMonth() + 1
  const ano = Number(params.ano) || agora.getUTCFullYear()
  const ini = inicioMes(ano, mes), fim = inicioMes(ano, mes + 1)
  const ini12 = inicioMes(ano, mes - 11)
  const anterior = { mes: mes === 1 ? 12 : mes - 1, ano: mes === 1 ? ano - 1 : ano }
  const proximo = { mes: mes === 12 ? 1 : mes + 1, ano: mes === 12 ? ano + 1 : ano }
  const em30 = new Date(hoje.getTime() + 30 * 86400000)

  const [pagosMes, pagos12, abertos, ultimoSaldo, recentes] = await Promise.all([
    prisma.financeTransaction.findMany({
      where: { status: 'PAGO', type: { in: ['RECEITA', 'DESPESA'] }, paidDate: { gte: ini, lt: fim } },
      select: { type: true, amount: true, category: { select: { name: true } } },
    }),
    prisma.financeTransaction.findMany({
      where: { status: 'PAGO', type: { in: ['RECEITA', 'DESPESA'] }, paidDate: { gte: ini12, lt: fim } },
      select: { type: true, amount: true, paidDate: true },
    }),
    prisma.financeTransaction.findMany({
      where: { status: 'PENDENTE', type: { in: ['RECEITA', 'DESPESA'] } },
      orderBy: { dueDate: 'asc' },
      include: { customer: { select: { name: true } }, supplier: { select: { name: true } } },
    }),
    prisma.saldoInvestimento.findFirst({ orderBy: { data: 'desc' } }),
    prisma.financeTransaction.findMany({
      where: { status: 'PAGO', paidDate: { gte: ini, lt: fim } },
      orderBy: { paidDate: 'desc' },
      take: 10,
      include: { category: { select: { name: true } }, customer: { select: { name: true } } },
    }),
  ])

  const soma = (ls: { amount: number }[]) => ls.reduce((s, l) => s + l.amount, 0)
  const recebido = soma(pagosMes.filter(l => l.type === 'RECEITA'))
  const pago = soma(pagosMes.filter(l => l.type === 'DESPESA'))
  const resultado = recebido - pago
  const aReceber = abertos.filter(l => l.type === 'RECEITA'), aPagar = abertos.filter(l => l.type === 'DESPESA')
  const vencidas = abertos.filter(l => l.dueDate < hoje)
  const proximas = abertos.filter(l => l.dueDate >= hoje && l.dueDate < em30)

  // 12 meses até o mês escolhido.
  const meses12 = Array.from({ length: 12 }, (_, i) => {
    const d = inicioMes(ano, mes - 11 + i)
    const ls = pagos12.filter(l => l.paidDate && l.paidDate.getUTCFullYear() === d.getUTCFullYear() && l.paidDate.getUTCMonth() === d.getUTCMonth())
    return { rotulo: `${MESES[d.getUTCMonth()]}/${String(d.getUTCFullYear()).slice(2)}`, receita: soma(ls.filter(l => l.type === 'RECEITA')), despesa: soma(ls.filter(l => l.type === 'DESPESA')) }
  })
  const maxBarra = Math.max(1, ...meses12.flatMap(m => [m.receita, m.despesa]))

  const porCategoria = (tipo: string) => {
    const mapa = new Map<string, number>()
    for (const l of pagosMes.filter(l => l.type === tipo)) mapa.set(l.category?.name || 'Sem categoria', (mapa.get(l.category?.name || 'Sem categoria') || 0) + l.amount)
    return [...mapa.entries()].sort((a, b) => b[1] - a[1])
  }
  const catReceitas = porCategoria('RECEITA'), catDespesas = porCategoria('DESPESA')
  const nomeMes = new Date(Date.UTC(ano, mes - 1, 2)).toLocaleString('pt-BR', { month: 'long', timeZone: 'UTC' })

  const Kpi = ({ titulo, valor, cor, detalhe, href }: { titulo: string; valor: number; cor?: string; detalhe?: string; href?: string }) => {
    const corpo = (
      <div className="card" style={{ padding: '1rem 1.25rem', height: '100%' }}>
        <div className="stat-label">{titulo}</div>
        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: cor }}>{moeda(valor)}</div>
        {detalhe && <div className="text-muted" style={{ fontSize: '0.78rem' }}>{detalhe}</div>}
      </div>
    )
    return href ? <Link href={href} style={{ color: 'inherit' }}>{corpo}</Link> : corpo
  }

  const Categorias = ({ titulo, itens, cor, total }: { titulo: string; itens: [string, number][]; cor: string; total: number }) => (
    <div className="card">
      <h3 style={{ fontSize: '1.05rem', marginBottom: '0.75rem' }}>{titulo}</h3>
      {itens.length === 0 ? <p className="text-muted">Nada no mês.</p> : itens.map(([nome, v]) => (
        <div key={nome} style={{ marginBottom: '0.6rem' }}>
          <div className="flex justify-between" style={{ fontSize: '0.88rem' }}><span>{nome}</span><strong>{moeda(v)}</strong></div>
          <div style={{ height: 6, borderRadius: 3, background: 'var(--surface-hover)' }}>
            <div style={{ height: 6, borderRadius: 3, width: `${Math.max(2, (v / total) * 100)}%`, background: cor }} />
          </div>
        </div>
      ))}
    </div>
  )

  const ListaContas = ({ titulo, itens, vazio, destaque }: { titulo: string; itens: typeof abertos; vazio: string; destaque?: string }) => (
    <div className="card">
      <div className="flex justify-between items-center" style={{ marginBottom: '0.75rem' }}>
        <h3 style={{ fontSize: '1.05rem', margin: 0, color: destaque }}>{titulo}</h3>
        <span className="text-muted" style={{ fontSize: '0.85rem' }}>{itens.length} · {moeda(soma(itens))}</span>
      </div>
      {itens.length === 0 ? <p className="text-muted">{vazio}</p> : (
        <div className="table-container">
          <table className="table">
            <tbody>
              {itens.slice(0, 10).map(t => (
                <tr key={t.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{formatarDataUTC(t.dueDate)}</td>
                  <td>
                    <Link href={`/financeiro/contas/${t.id}`} className="text-primary">{t.description}</Link>
                    <div className="text-muted" style={{ fontSize: '0.75rem' }}>{t.customer?.name || t.supplier?.name || ''}</div>
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap', color: t.type === 'RECEITA' ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 600 }}>
                    {t.type === 'RECEITA' ? '+' : '−'} {moeda(t.amount)}
                  </td>
                  <td><BaixaPagamento action={registrarPagamento.bind(null, t.id)} tipo={t.type} formaAtual={t.paymentMethod} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {itens.length > 10 && <Link href="/financeiro/contas?aberto=todos" className="text-primary" style={{ fontSize: '0.85rem' }}>Ver todas ({itens.length})</Link>}
    </div>
  )

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-4" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
        <div className="flex items-center" style={{ gap: '0.5rem' }}>
          <Link href={`/financeiro?mes=${anterior.mes}&ano=${anterior.ano}`} className="btn btn-outline" style={{ padding: '0.3rem 0.65rem' }} aria-label="Mês anterior">‹</Link>
          <strong style={{ minWidth: 150, textAlign: 'center', textTransform: 'capitalize', fontSize: '1.05rem' }}>{nomeMes} de {ano}</strong>
          <Link href={`/financeiro?mes=${proximo.mes}&ano=${proximo.ano}`} className="btn btn-outline" style={{ padding: '0.3rem 0.65rem' }} aria-label="Próximo mês">›</Link>
        </div>
        <div className="flex" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
          <Link href="/financeiro/importar" className="btn btn-outline">📥 Importar extrato</Link>
          <Link href="/financeiro/contas/novo" className="btn btn-primary">+ Novo lançamento</Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
        <Kpi titulo="Recebido no mês" valor={recebido} cor="var(--accent-green)" href={`/financeiro/contas?tipo=RECEITA&mes=${mes}&ano=${ano}`} />
        <Kpi titulo="Pago no mês" valor={pago} cor="var(--accent-red)" href={`/financeiro/contas?tipo=DESPESA&mes=${mes}&ano=${ano}`} />
        <Kpi titulo="Resultado do mês" valor={resultado} cor={resultado >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'} detalhe="Recebido − pago" />
        <Kpi titulo="A receber (em aberto)" valor={soma(aReceber)} detalhe={`${aReceber.length} conta(s)`} href="/financeiro/contas?aberto=RECEITA" />
        <Kpi titulo="A pagar (em aberto)" valor={soma(aPagar)} detalhe={`${aPagar.length} conta(s)`} href="/financeiro/contas?aberto=DESPESA" />
        <Kpi titulo="Investimentos" valor={ultimoSaldo?.valor ?? 0} detalhe={ultimoSaldo ? `Saldo em ${formatarDataUTC(ultimoSaldo.data)}` : 'Informe o saldo'} href="/financeiro/investimentos" />
      </div>

      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div className="flex justify-between items-center" style={{ marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3 style={{ fontSize: '1.05rem', margin: 0 }}>Últimos 12 meses</h3>
          <span className="text-muted" style={{ fontSize: '0.8rem' }}>
            <span style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--accent-green)', borderRadius: 2, marginRight: 4 }} />Recebido
            <span style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--accent-red)', borderRadius: 2, margin: '0 4px 0 12px' }} />Pago
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: '0.4rem', alignItems: 'end', height: 170 }}>
          {meses12.map(m => (
            <div key={m.rotulo} title={`${m.rotulo}: recebido ${moeda(m.receita)} · pago ${moeda(m.despesa)} · resultado ${moeda(m.receita - m.despesa)}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
              <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 140, width: '100%', justifyContent: 'center' }}>
                <div style={{ width: '40%', maxWidth: 18, height: `${(m.receita / maxBarra) * 100}%`, minHeight: m.receita ? 2 : 0, background: 'var(--accent-green)', borderRadius: '3px 3px 0 0' }} />
                <div style={{ width: '40%', maxWidth: 18, height: `${(m.despesa / maxBarra) * 100}%`, minHeight: m.despesa ? 2 : 0, background: 'var(--accent-red)', borderRadius: '3px 3px 0 0' }} />
              </div>
              <span className="text-muted" style={{ fontSize: '0.7rem', marginTop: 4 }}>{m.rotulo}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
        <ListaContas titulo="⚠ Vencidas" itens={vencidas} vazio="Nenhuma conta vencida." destaque={vencidas.length ? 'var(--accent-red)' : undefined} />
        <ListaContas titulo="Próximos 30 dias" itens={proximas} vazio="Nada vencendo nos próximos 30 dias." />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
        <Categorias titulo="Receitas por categoria" itens={catReceitas} cor="var(--accent-green)" total={recebido || 1} />
        <Categorias titulo="Despesas por categoria" itens={catDespesas} cor="var(--accent-red)" total={pago || 1} />
      </div>

      <div className="card">
        <div className="flex justify-between items-center" style={{ marginBottom: '0.75rem' }}>
          <h3 style={{ fontSize: '1.05rem', margin: 0 }}>Últimas movimentações do mês</h3>
          <Link href={`/financeiro/contas?mes=${mes}&ano=${ano}`} className="text-primary" style={{ fontSize: '0.85rem' }}>Ver todas</Link>
        </div>
        {recentes.length === 0 ? <p className="text-muted">Nenhuma movimentação neste mês.</p> : (
          <div className="table-container">
            <table className="table">
              <tbody>
                {recentes.map(t => (
                  <tr key={t.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{t.paidDate ? formatarDataUTC(t.paidDate) : ''}</td>
                    <td><Link href={`/financeiro/contas/${t.id}`} className="text-primary">{t.description.slice(0, 80)}</Link>
                      <div className="text-muted" style={{ fontSize: '0.75rem' }}>{[t.category?.name, t.customer?.name].filter(Boolean).join(' · ')}</div></td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 600, color: t.type === 'RECEITA' ? 'var(--accent-green)' : t.type === 'DESPESA' ? 'var(--accent-red)' : 'var(--text-muted)' }}>
                      {t.type === 'RECEITA' ? '+' : t.type === 'DESPESA' ? '−' : ''} {moeda(t.amount)}
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
