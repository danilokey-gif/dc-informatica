import Link from "next/link"
import { prisma } from "@/lib/prisma"
import CampoValor from "@/components/CampoValor"
import { rotuloTipo, corTipo } from "@/lib/financeiro-tipos"
import { salvarSaldoInvestimento, excluirSaldoInvestimento } from "./actions"
import ImportarCaixinha from "./ImportarCaixinha"
import { resumoInvestimento } from "@/lib/investimento-bruto"

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
  const bruto = resumoInvestimento([...saldos].reverse())
  const brutoPorId = new Map(bruto.linhas.map(l => [l.id, l]))
  const pct = (v: number) => `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
  const hoje = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10)

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-4 mb-4" style={{ flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0 }}>Investimentos e sócio</h3>
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

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1.05rem', marginBottom: '0.25rem' }}>Valor bruto e imposto (desde 01/01/2026)</h3>
        <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: 0 }}>
          O saldo do banco já vem com o imposto descontado. Somando de volta o IR retido, vemos quanto o investimento valeria sem imposto.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div>
            <div className="stat-label">Valor bruto (sem IR)</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{bruto.valorBruto != null ? moeda(bruto.valorBruto) : '—'}</div>
            <div className="text-muted" style={{ fontSize: '0.78rem' }}>Saldo líquido + IR já retido</div>
          </div>
          <div>
            <div className="stat-label">Rendimento bruto</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent-green)' }}>{moeda(bruto.rendimentoBruto)}</div>
            <div className="text-muted" style={{ fontSize: '0.78rem' }}>Antes do imposto</div>
          </div>
          <div>
            <div className="stat-label">IR/IOF retido</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent-red)' }}>{moeda(bruto.imposto)}</div>
            <div className="text-muted" style={{ fontSize: '0.78rem' }}>Descontado nas renovações do RDB</div>
          </div>
          <div>
            <div className="stat-label">Imposto sobre o rendimento</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{bruto.percentual != null ? pct(bruto.percentual) : '—'}</div>
            <div className="text-muted" style={{ fontSize: '0.78rem' }}>IR retido ÷ rendimento bruto</div>
          </div>
        </div>
        <p className="text-muted" style={{ fontSize: '0.75rem', marginTop: '0.75rem', marginBottom: 0 }}>
          O imposto só é descontado quando o RDB renova, então parte do rendimento ainda vai pagar IR e a porcentagem real é maior do que a retida até agora.
          A tabela do IR em renda fixa: 22,5% até 180 dias, 20% de 181 a 360, 17,5% de 361 a 720 e 15% acima de 720 dias (o IOF só vale nos primeiros 30 dias).
          Só entram os meses lidos do extrato da Caixinha em PDF.
        </p>
      </div>

      <div style={{ marginBottom: '1rem' }}><ImportarCaixinha /></div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card">
          <h3 style={{ fontSize: '1.05rem' }}>Saldo do investimento (ou lance à mão)</h3>
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

      {saldos.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1.05rem' }}>Histórico de saldos</h3>
          <div className="table-container">
            <table className="table">
              <thead><tr>
                <th>Data</th><th>Observação</th><th style={{ textAlign: 'right' }}>Saldo líquido</th><th style={{ textAlign: 'right' }}>Rendimento bruto</th>
                <th style={{ textAlign: 'right' }}>IR/IOF retido</th><th style={{ textAlign: 'right' }}>Valor bruto</th><th style={{ textAlign: 'right' }}>Rendeu no período</th><th></th>
              </tr></thead>
              <tbody>
                {saldos.map((s, i) => {
                  // Rendimento líquido entre este saldo e o anterior: diferença menos o que foi aplicado/resgatado no meio.
                  const anterior = saldos[i + 1]
                  const fluxo = anterior ? movimentos.filter(m => m.dueDate > anterior.data && m.dueDate <= s.data)
                    .reduce((t, m) => t + (m.type === 'APLICACAO' ? m.amount : m.type === 'RESGATE' ? -m.amount : 0), 0) : 0
                  const rendeu = anterior ? s.valor - anterior.valor - fluxo : null
                  const linha = brutoPorId.get(s.id)
                  const temExtrato = s.rendimentoBruto != null
                  return (
                  <tr key={s.id}>
                    <td>{dataBr(s.data)}</td><td>{s.descricao}</td><td style={{ textAlign: 'right' }}>{moeda(s.valor)}</td>
                    <td style={{ textAlign: 'right' }}>{temExtrato ? moeda(s.rendimentoBruto!) : '—'}</td>
                    <td style={{ textAlign: 'right', color: s.impostoRetido ? 'var(--accent-red)' : undefined }}>{temExtrato ? (s.impostoRetido ? moeda(s.impostoRetido) : '—') : '—'}</td>
                    <td style={{ textAlign: 'right' }}>{temExtrato && linha ? moeda(linha.valorBruto) : '—'}</td>
                    <td style={{ textAlign: 'right', color: rendeu != null && rendeu >= 0 ? 'var(--accent-green)' : undefined }}>{rendeu != null ? moeda(rendeu) : '—'}</td>
                    <td style={{ width: 40 }}>
                      <form action={excluirSaldoInvestimento.bind(null, s.id)}><button className="btn btn-outline" style={{ padding: '0.15rem 0.5rem' }} title="Excluir">×</button></form>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
