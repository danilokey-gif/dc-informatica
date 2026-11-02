import Link from "next/link"
import { prisma } from "@/lib/prisma"
import BotaoVoltar from "@/components/BotaoVoltar"
import CampoValor from "@/components/CampoValor"
import { rotuloTipo, corTipo } from "@/lib/financeiro-tipos"
import { salvarSaldoInvestimento, excluirSaldoInvestimento } from "./actions"

export const dynamic = 'force-dynamic'

const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dataBr = (d: Date) => d.toLocaleDateString('pt-BR', { timeZone: 'UTC' })

/**
 * Investimentos (aplicações e resgates, ex.: RDB do Nubank) e movimentos do sócio (aportes e
 * retiradas). Nada daqui é receita ou despesa: fica fora do resultado da empresa.
 */
export default async function InvestimentosPage() {
  const [movimentos, saldos] = await Promise.all([
    prisma.financeTransaction.findMany({
      where: { type: { in: ['APLICACAO', 'RESGATE', 'APORTE', 'RETIRADA'] }, status: { not: 'CANCELADO' } },
      orderBy: { dueDate: 'desc' },
    }),
    prisma.saldoInvestimento.findMany({ orderBy: { data: 'desc' } }),
  ])

  const soma = (tipo: string) => movimentos.filter(m => m.type === tipo).reduce((s, m) => s + m.amount, 0)
  const aplicado = soma('APLICACAO'), resgatado = soma('RESGATE')
  const liquido = aplicado - resgatado
  const ultimo = saldos[0]
  // Rendimento até a data do último saldo informado: saldo − (aplicações − resgates até aquela data).
  const liquidoAteUltimo = ultimo
    ? movimentos.filter(m => m.dueDate <= ultimo.data).reduce((s, m) => s + (m.type === 'APLICACAO' ? m.amount : m.type === 'RESGATE' ? -m.amount : 0), 0)
    : 0
  const rendimento = ultimo ? ultimo.valor - liquidoAteUltimo : null
  const aportes = soma('APORTE'), retiradas = soma('RETIRADA')
  const hoje = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10)

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-4 mb-4" style={{ flexWrap: 'wrap' }}>
        <BotaoVoltar padrao="/financeiro" />
        <h2 style={{ margin: 0 }}>Investimentos e sócio</h2>
      </div>
      <p className="text-muted mb-4" style={{ maxWidth: 820 }}>
        Aplicações e resgates (ex.: RDB do Nubank), dinheiro que você coloca na empresa (aporte) e o que tira para você (retirada).
        Nada desta tela é receita ou despesa: não entra no faturamento nem nos gastos da empresa.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card">
          <div className="stat-label">Aplicado</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{moeda(aplicado)}</div>
          <div className="text-muted" style={{ fontSize: '0.8rem' }}>Resgatado: {moeda(resgatado)}</div>
        </div>
        <div className="card">
          <div className="stat-label">Líquido investido</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{moeda(liquido)}</div>
          <div className="text-muted" style={{ fontSize: '0.8rem' }}>Aplicações − resgates</div>
        </div>
        <div className="card" style={{ borderColor: 'var(--primary)' }}>
          <div className="stat-label">Saldo do investimento</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)' }}>{ultimo ? moeda(ultimo.valor) : '—'}</div>
          <div className="text-muted" style={{ fontSize: '0.8rem' }}>{ultimo ? `Informado em ${dataBr(ultimo.data)}` : 'Informe abaixo o saldo do app do banco'}</div>
        </div>
        <div className="card">
          <div className="stat-label">Rendimento</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: rendimento != null && rendimento >= 0 ? 'var(--accent-green)' : undefined }}>{rendimento != null ? moeda(rendimento) : '—'}</div>
          <div className="text-muted" style={{ fontSize: '0.8rem' }}>Saldo informado − líquido aplicado</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card">
          <h3 style={{ fontSize: '1.05rem' }}>Atualizar saldo do investimento</h3>
          <p className="text-muted" style={{ fontSize: '0.8rem' }}>
            No app do Nubank PJ, veja o valor guardado/investido (RDB) com os rendimentos e lance aqui. O sistema calcula quanto rendeu.
          </p>
          <form action={salvarSaldoInvestimento} className="flex gap-4" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="input-group" style={{ marginBottom: 0, minWidth: 160 }}>
              <label className="input-label" htmlFor="valor">Saldo</label>
              <CampoValor id="valor" name="valor" required />
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label" htmlFor="data">Data</label>
              <input type="date" id="data" name="data" className="input-field" defaultValue={hoje} max={hoje} required />
            </div>
            <div className="input-group" style={{ marginBottom: 0, flex: 1, minWidth: 140 }}>
              <label className="input-label" htmlFor="descricao">Onde</label>
              <input id="descricao" name="descricao" className="input-field" defaultValue="RDB Nubank PJ" />
            </div>
            <button type="submit" className="btn btn-primary">Salvar</button>
          </form>
          {saldos.length > 0 && (
            <table className="table" style={{ marginTop: '1rem' }}>
              <tbody>
                {saldos.map(s => (
                  <tr key={s.id}>
                    <td>{dataBr(s.data)}</td><td>{s.descricao}</td><td style={{ textAlign: 'right' }}>{moeda(s.valor)}</td>
                    <td style={{ width: 40 }}>
                      <form action={excluirSaldoInvestimento.bind(null, s.id)}><button className="btn btn-outline" style={{ padding: '0.15rem 0.5rem' }} title="Excluir">×</button></form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="card">
          <h3 style={{ fontSize: '1.05rem' }}>Sócio</h3>
          <p style={{ margin: '0.25rem 0' }}>Aportes (você → empresa): <strong>{moeda(aportes)}</strong></p>
          <p style={{ margin: '0.25rem 0' }}>Retiradas (empresa → você): <strong>{moeda(retiradas)}</strong></p>
          <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.75rem' }}>
            O extrato importado reconhece sozinho os Pix entre o seu CPF e a conta da empresa, e as aplicações/resgates do Nubank.
          </p>
        </div>
      </div>

      <div className="card">
        <h3 style={{ fontSize: '1.05rem' }}>Movimentações</h3>
        {movimentos.length === 0 ? <p className="text-muted">Nenhuma movimentação.</p> : (
          <div className="table-container">
            <table className="table">
              <thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th style={{ textAlign: 'right' }}>Valor</th></tr></thead>
              <tbody>
                {movimentos.map(m => (
                  <tr key={m.id}>
                    <td>{dataBr(m.dueDate)}</td>
                    <td style={{ color: corTipo(m.type), fontWeight: 600 }}>{rotuloTipo(m.type)}</td>
                    <td><Link href={`/financeiro/contas/${m.id}`} className="text-primary">{m.description.slice(0, 90)}</Link></td>
                    <td style={{ textAlign: 'right' }}>{moeda(m.amount)}</td>
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
