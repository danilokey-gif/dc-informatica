import { prisma } from "@/lib/prisma"
import Link from "next/link"
import SearchableSelect from "@/components/SearchableSelect"
import { hojeEmBrasilia } from "@/lib/cobranca-mensal"
import { salvarCobranca, alternarCobranca, emitirCobrancaAgora, liberarCompetencia, excluirCobranca } from "./actions"
import BotaoConfirmar from "./BotaoConfirmar"

export const dynamic = 'force-dynamic'

const BRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** Texto da próxima emissão, a partir do dia marcado e da última competência já processada. */
function proximaEmissao(diaDoMes: number, ultimaCompetencia: string | null, ativa: boolean): string {
  if (!ativa) return 'Desligada — não sai nota sozinha.'
  const hoje = hojeEmBrasilia()
  const [ano, mes] = hoje.competencia.split('-').map(Number)
  const dia = String(diaDoMes).padStart(2, '0')
  if (ultimaCompetencia === hoje.competencia) {
    const proximoMes = mes === 12 ? 1 : mes + 1
    const proximoAno = mes === 12 ? ano + 1 : ano
    return `${dia}/${String(proximoMes).padStart(2, '0')}/${proximoAno} (a deste mês já saiu)`
  }
  if (hoje.dia <= diaDoMes) return `${dia}/${String(mes).padStart(2, '0')}/${ano}, às 9h`
  return 'Hoje, na próxima execução da rotina (o dia já passou e a nota deste mês ainda não saiu).'
}

export default async function CobrancasMensaisPage({ searchParams }: { searchParams: Promise<{ msg?: string; erro?: string; editar?: string }> }) {
  const { msg, erro, editar } = await searchParams
  const hoje = hojeEmBrasilia()

  const [cobrancas, clientes, nfseConfig] = await Promise.all([
    prisma.cobrancaMensal.findMany({ include: { customer: true }, orderBy: { createdAt: 'asc' } }),
    prisma.customer.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.nfseConfig.findUnique({ where: { id: 'main' }, select: { codigoServico: true } }),
  ])
  const emEdicao = editar ? cobrancas.find(c => c.id === editar) : undefined

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-4" style={{ flexWrap: 'wrap', gap: '1rem' }}>
        <h2 style={{ margin: 0 }}>Cobranças Mensais</h2>
        <Link href="/financeiro" className="text-muted">Voltar ao Financeiro</Link>
      </div>

      <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>
        Serviços cobrados todo mês, como o aluguel do sistema. No dia marcado, às 9h, o sistema emite a NFS-e sozinho,
        lança a receita como pendente no Financeiro e manda a nota por e-mail para o cliente, com o PIX e uma cópia para você.
        Se algo der errado, você recebe um e-mail avisando, e a nota não é tentada de novo sozinha, para nunca sair em dobro.
      </p>

      {msg && <div className="card" style={{ borderLeft: '4px solid var(--accent-green)', marginBottom: '1rem', fontSize: '0.9rem' }}>{msg}</div>}
      {erro && <div className="card" style={{ borderLeft: '4px solid var(--accent-red)', marginBottom: '1rem', fontSize: '0.9rem', color: 'var(--accent-red)' }}>{erro}</div>}

      {!process.env.CRON_SECRET && (
        <div className="card" style={{ borderLeft: '4px solid var(--accent-yellow, #d97706)', marginBottom: '1rem', fontSize: '0.85rem' }}>
          A rotina automática está funcionando, mas sem senha própria. Recomendado: cadastrar a variável <code>CRON_SECRET</code> nas
          configurações do projeto na Vercel (Settings → Environment Variables), com qualquer texto longo e aleatório.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
        {cobrancas.length === 0 && <p className="text-muted">Nenhuma cobrança mensal cadastrada.</p>}
        {cobrancas.map(c => (
          <div key={c.id} className="card" style={{ borderLeft: `4px solid ${c.ativa ? 'var(--accent-green)' : 'var(--border)'}` }}>
            <div className="flex justify-between items-center" style={{ flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <h3 style={{ margin: 0 }}>{c.customer.name}</h3>
              <span className={`badge ${c.ativa ? 'badge-success' : 'badge-neutral'}`}>{c.ativa ? 'Ligada' : 'Desligada'}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem 1.5rem', fontSize: '0.875rem' }}>
              <div><span className="text-muted">Serviço:</span> {c.descricao}</div>
              <div><span className="text-muted">Valor:</span> <strong>{BRL(c.valor)}</strong></div>
              <div><span className="text-muted">Todo dia:</span> {c.diaDoMes}</div>
              <div><span className="text-muted">Código de serviço:</span> {c.codigoServico}</div>
              <div><span className="text-muted">Vencimento:</span> {c.diasParaVencimento} dia(s) após a emissão</div>
              <div>
                <span className="text-muted">Envio:</span>{' '}
                {c.enviarEmail ? (c.customer.email ? `e-mail para ${c.customer.email}` : <span style={{ color: 'var(--accent-red)' }}>cliente sem e-mail</span>) : 'não envia'}
                {c.enviarEmail && c.incluirPix ? ' + PIX' : ''}
              </div>
            </div>
            <p style={{ fontSize: '0.875rem', margin: '0.75rem 0 0' }}>
              <span className="text-muted">Próxima nota:</span> {proximaEmissao(c.diaDoMes, c.ultimaCompetencia, c.ativa)}
            </p>
            {c.ultimoResultado && (
              <p style={{ fontSize: '0.8rem', margin: '0.25rem 0 0' }} className="text-muted">
                Última execução{c.ultimoProcessamento ? ` (${c.ultimoProcessamento.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })})` : ''}: {c.ultimoResultado}
                {c.ultimaOsId && <> — <Link href={`/os/${c.ultimaOsId}/imprimir`} className="text-primary">ver a OS</Link></>}
              </p>
            )}
            <div className="flex gap-4" style={{ flexWrap: 'wrap', marginTop: '1rem', alignItems: 'center' }}>
              <Link href={`?editar=${c.id}#formulario`} className="btn btn-outline">Editar</Link>
              <form action={alternarCobranca.bind(null, c.id)}>
                <button type="submit" className="btn btn-outline">{c.ativa ? 'Desligar' : 'Ligar'}</button>
              </form>
              {c.ultimaCompetencia !== hoje.competencia && (
                <BotaoConfirmar
                  acao={emitirCobrancaAgora.bind(null, c.id)}
                  confirmacao={`Emitir AGORA a NFS-e de ${hoje.rotulo} para ${c.customer.name}, no valor de ${BRL(c.valor)}? A nota deste mês não sairá de novo no dia ${c.diaDoMes}.`}
                  rotulo={`Emitir a de ${hoje.rotulo} agora`}
                  rotuloPendente="Emitindo…"
                />
              )}
              {c.ultimaCompetencia === hoje.competencia && (
                <BotaoConfirmar
                  acao={liberarCompetencia.bind(null, c.id)}
                  confirmacao={`Só continue se você conferiu que a nota de ${hoje.rotulo} NÃO foi emitida (por exemplo, depois de um erro). Liberar o mês permite emitir de novo e, se a nota já tiver saído, ela sairá em dobro.`}
                  rotulo="Liberar o mês para nova tentativa"
                  className="btn btn-outline"
                  style={{ fontSize: '0.8rem' }}
                />
              )}
              <BotaoConfirmar
                acao={excluirCobranca.bind(null, c.id)}
                confirmacao={`Excluir a cobrança mensal de ${c.customer.name}? As notas já emitidas continuam no sistema.`}
                rotulo="Excluir"
                className="btn btn-danger"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="card" id="formulario">
        <h3 className="mb-4">{emEdicao ? `Editar cobrança — ${emEdicao.customer.name}` : 'Nova cobrança mensal'}</h3>
        <form action={salvarCobranca} key={emEdicao?.id || 'nova'}>
          {emEdicao && <input type="hidden" name="id" value={emEdicao.id} />}
          <div className="input-group">
            <label className="input-label" htmlFor="customerId">Cliente *</label>
            <SearchableSelect
              id="customerId"
              name="customerId"
              required
              defaultValue={emEdicao?.customerId}
              placeholder="Digite o nome do cliente..."
              options={clientes.map(cl => ({ value: cl.id, label: cl.name }))}
            />
          </div>
          <div className="input-group">
            <label className="input-label" htmlFor="descricao">Descrição na nota *</label>
            <input id="descricao" name="descricao" className="input-field" required defaultValue={emEdicao?.descricao || 'Aluguel do sistema de gestão'} />
            <p className="text-muted" style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>A competência é acrescentada sozinha, ex.: &quot;— competência {hoje.rotulo}&quot;.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0 1rem' }}>
            <div className="input-group">
              <label className="input-label" htmlFor="valor">Valor (R$) *</label>
              <input id="valor" name="valor" type="number" step="0.01" min="0.01" className="input-field" required defaultValue={emEdicao?.valor ?? 120} />
            </div>
            <div className="input-group">
              <label className="input-label" htmlFor="diaDoMes">Dia do mês (1 a 28) *</label>
              <input id="diaDoMes" name="diaDoMes" type="number" min="1" max="28" className="input-field" required defaultValue={emEdicao?.diaDoMes ?? 10} />
            </div>
            <div className="input-group">
              <label className="input-label" htmlFor="diasParaVencimento">Vencimento (dias após a emissão)</label>
              <input id="diasParaVencimento" name="diasParaVencimento" type="number" min="0" max="60" className="input-field" required defaultValue={emEdicao?.diasParaVencimento ?? 10} />
            </div>
            <div className="input-group">
              <label className="input-label" htmlFor="codigoServico">Código de serviço *</label>
              <input id="codigoServico" name="codigoServico" className="input-field" required defaultValue={emEdicao?.codigoServico ?? nfseConfig?.codigoServico ?? ''} />
            </div>
          </div>
          <div className="flex gap-4" style={{ flexWrap: 'wrap', margin: '0.5rem 0 1.5rem', fontSize: '0.9rem' }}>
            <label><input type="checkbox" name="ativa" defaultChecked={emEdicao?.ativa ?? true} /> Ligada (emite sozinha no dia)</label>
            <label><input type="checkbox" name="enviarEmail" defaultChecked={emEdicao?.enviarEmail ?? true} /> Enviar a nota por e-mail</label>
            <label><input type="checkbox" name="incluirPix" defaultChecked={emEdicao?.incluirPix ?? true} /> Incluir PIX no e-mail</label>
          </div>
          <div className="flex gap-4">
            <button type="submit" className="btn btn-primary">{emEdicao ? 'Salvar alterações' : 'Criar cobrança'}</button>
            {emEdicao && <Link href="/financeiro/cobrancas-mensais" className="btn btn-outline">Cancelar edição</Link>}
          </div>
        </form>
      </div>
    </div>
  )
}
