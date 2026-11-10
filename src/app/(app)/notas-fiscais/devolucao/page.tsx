import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { lerNotaOriginal, quantidadesDevolvidas, notaEhDaEmpresa, type NotaOriginal } from "@/lib/nfe/devolucao"
import BotaoVoltar from "@/components/BotaoVoltar"
import FormDevolucao from "./FormDevolucao"

export const dynamic = 'force-dynamic'

const moeda = (v: number | null | undefined) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dataBr = (d: Date | null | undefined) => (d ? d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '')

/**
 * Nota de devolução (NF-e finNFe 4). Duas situações:
 * - devolver ao fornecedor uma compra (parte das notas de compra com XML completo);
 * - registrar que o cliente devolveu uma venda (parte das NF-e de venda autorizadas).
 */
export default async function DevolucaoPage({ searchParams }: { searchParams: Promise<{ tipo?: string; id?: string }> }) {
  const { tipo: tipoParam, id } = await searchParams
  const tipo = tipoParam === 'venda' ? 'venda' : tipoParam === 'compra' ? 'compra' : null

  const [compras, vendas, devolucoes, vendasTeste] = await Promise.all([
    prisma.nfeRecebida.findMany({
      where: { completa: true, situacao: { not: '3' } },
      orderBy: { dataEmissao: 'desc' },
      take: 30,
      select: { id: true, numero: true, emitenteNome: true, valorTotal: true, dataEmissao: true },
    }),
    prisma.nfeEmissao.findMany({
      where: { status: 'AUTORIZADA', ambiente: 'producao', finalidade: 'VENDA', xmlNfe: { not: null } },
      orderBy: { dataEmissao: 'desc' },
      take: 30,
      include: { sale: { include: { customer: true } } },
    }),
    prisma.nfeEmissao.findMany({
      where: { finalidade: { in: ['DEVOLUCAO_COMPRA', 'DEVOLUCAO_VENDA'] } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    // Notas de venda autorizadas na homologação: servem de origem para testar a devolução sem valor fiscal.
    prisma.nfeEmissao.findMany({
      where: { status: 'AUTORIZADA', ambiente: 'homologacao', finalidade: 'VENDA', xmlNfe: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, numero: true, serie: true, valorTotal: true, dataEmissao: true, createdAt: true },
    }),
  ])

  const empresa = await prisma.companySettings.findUnique({ where: { id: 'main' }, select: { document: true } }) ?? { document: null }
  let original: NotaOriginal | null = null
  let erroOriginal: string | null = null
  let restantes: Record<number, number> = {}
  let origemDeTeste = false
  if (tipo && id) {
    try {
      let xml: string | null | undefined
      if (tipo === 'compra') xml = (await prisma.nfeRecebida.findUnique({ where: { id } }))?.xml
      else {
        const nota = await prisma.nfeEmissao.findUnique({ where: { id }, select: { xmlNfe: true, ambiente: true } })
        xml = nota?.xmlNfe
        origemDeTeste = !!nota && nota.ambiente !== 'producao'
      }
      if (!xml) throw new Error('Nota não encontrada.')
      original = lerNotaOriginal(xml, tipo)
      const anteriores = await prisma.nfeEmissao.findMany({
        where: { chaveReferenciada: original.chave, status: 'AUTORIZADA', ambiente: origemDeTeste ? 'homologacao' : 'producao' },
        select: { xmlNfe: true },
      })
      const ja = quantidadesDevolvidas(anteriores.map(a => a.xmlNfe))
      restantes = Object.fromEntries(original.itens.map(i => [i.nItem, Math.max(0, i.quantidade - (ja.get(i.codigo) ?? 0))]))
    } catch (e) {
      erroOriginal = e instanceof Error ? e.message : String(e)
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-4 mb-4" style={{ flexWrap: 'wrap' }}>
        <BotaoVoltar padrao="/notas-fiscais" />
        <h1 style={{ margin: 0 }}>Nota de Devolução</h1>
      </div>
      <p className="text-muted mb-4" style={{ maxWidth: 820 }}>
        Emite a NF-e de devolução referenciando a nota original. Os itens, valores e o destinatário saem da nota original;
        você escolhe só o que está sendo devolvido. Para MEI, o CFOP é definido sozinho (5.202/6.202 na devolução de compra;
        1.202/2.202 na devolução de venda).
      </p>

      {!original && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.25rem' }}>
          <div className="card">
            <h3 style={{ fontSize: '1.1rem' }}>📤 Devolver compra ao fornecedor</h3>
            <p className="text-muted" style={{ fontSize: '0.85rem' }}>Escolha a nota de compra (só aparecem as que têm o XML completo no sistema).</p>
            {compras.length === 0 && <p className="text-muted">Nenhuma nota de compra com XML completo.</p>}
            {compras.map(c => (
              <Link key={c.id} href={`/notas-fiscais/devolucao?tipo=compra&id=${c.id}`} className="pendencia-nota" style={{ marginTop: '0.5rem' }}>
                <span><strong>NF-e {c.numero}</strong> · {c.emitenteNome}<br /><span className="text-muted" style={{ fontSize: '0.8rem' }}>{dataBr(c.dataEmissao)}</span></span>
                <span>{moeda(c.valorTotal)}</span>
              </Link>
            ))}
          </div>
          <div className="card">
            <h3 style={{ fontSize: '1.1rem' }}>📥 Cliente devolveu uma venda</h3>
            <p className="text-muted" style={{ fontSize: '0.85rem' }}>Escolha a NF-e de venda (emitida pelo sistema ou importada).</p>
            {vendas.length === 0 && <p className="text-muted">Nenhuma NF-e de venda autorizada.</p>}
            {vendas.map(v => (
              <Link key={v.id} href={`/notas-fiscais/devolucao?tipo=venda&id=${v.id}`} className="pendencia-nota" style={{ marginTop: '0.5rem' }}>
                <span><strong>NF-e {v.numero}</strong> · {v.sale?.customer?.name || v.destinatarioNome || 'Cliente'}<br /><span className="text-muted" style={{ fontSize: '0.8rem' }}>{dataBr(v.dataEmissao)}</span></span>
                <span>{moeda(v.valorTotal ?? v.sale?.total)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {!original && vendasTeste.length > 0 && (
        <div className="card mt-4">
          <h3 style={{ fontSize: '1.1rem' }}>🧪 Testar a devolução na homologação</h3>
          <p className="text-muted" style={{ fontSize: '0.85rem' }}>
            Notas de venda de teste (sem valor fiscal). A devolução delas também vai só para a homologação: não usa a numeração real nem mexe no estoque.
          </p>
          {vendasTeste.map(v => (
            <Link key={v.id} href={`/notas-fiscais/devolucao?tipo=venda&id=${v.id}`} className="pendencia-nota" style={{ marginTop: '0.5rem' }}>
              <span><strong>NF-e {v.numero}</strong> (série {v.serie}) · teste<br /><span className="text-muted" style={{ fontSize: '0.8rem' }}>{dataBr(v.dataEmissao || v.createdAt)}</span></span>
              <span>{moeda(v.valorTotal)}</span>
            </Link>
          ))}
        </div>
      )}

      {erroOriginal && <div className="card" style={{ color: 'var(--badge-danger-text)' }}>{erroOriginal} <Link href="/notas-fiscais/devolucao" className="text-primary">Voltar</Link></div>}

      {original && tipo && id && (
        <div className="card">
          <div className="flex justify-between" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>
                {tipo === 'compra' ? '📤 Devolução de compra' : '📥 Devolução de venda'} · NF-e {original.numero}
              </h3>
              <p className="text-muted" style={{ fontSize: '0.85rem', margin: 0 }}>
                {tipo === 'compra' ? 'Fornecedor' : 'Cliente'}: <strong>{original.parte.nome}</strong> ({original.parte.documento}) · {original.parte.endereco?.nomeMunicipio}/{original.parte.endereco?.uf}
              </p>
            </div>
            <Link href="/notas-fiscais/devolucao" className="btn btn-outline" style={{ alignSelf: 'flex-start' }}>Trocar nota</Link>
          </div>
          {origemDeTeste && (
            <div style={{ marginTop: '1rem', padding: '0.75rem', borderRadius: 'var(--radius-md)', background: 'var(--badge-warning-bg)', color: 'var(--badge-warning-text)', fontSize: '0.9rem' }}>
              🧪 Nota de teste (homologação). A devolução será enviada só como teste, sem valor fiscal.
            </div>
          )}
          {!origemDeTeste && !notaEhDaEmpresa(original, tipo, empresa.document || '') && (
            <div style={{ marginTop: '1rem', padding: '0.75rem', borderRadius: 'var(--radius-md)', background: 'var(--badge-warning-bg)', color: 'var(--badge-warning-text)', fontSize: '0.9rem' }}>
              ⚠ {tipo === 'compra'
                ? <>Esta compra saiu no documento <strong>{original.documentoDestinatario}</strong>, não no CNPJ da empresa. A empresa não pode emitir a devolução dela: a troca precisa ser tratada direto com o fornecedor. Só o teste na homologação fica liberado.</>
                : <>Esta NF-e não foi emitida pelo CNPJ da empresa. Só o teste na homologação fica liberado.</>}
            </div>
          )}
          <FormDevolucao tipo={tipo} origemId={id} itens={original.itens} restantes={restantes}
            somenteTeste={origemDeTeste || !notaEhDaEmpresa(original, tipo, empresa.document || '')} />
        </div>
      )}

      {devolucoes.length > 0 && (
        <div className="card mt-4">
          <h3 style={{ fontSize: '1.1rem' }}>Devoluções emitidas</h3>
          <div className="table-container">
            <table className="table">
              <thead><tr><th>Nº</th><th>Tipo</th><th>Destinatário</th><th>Valor</th><th>Situação</th><th></th></tr></thead>
              <tbody>
                {devolucoes.map(d => (
                  <tr key={d.id}>
                    <td>{d.numero}{d.ambiente === 'homologacao' && <span className="badge badge-neutral" style={{ marginLeft: 6 }}>teste</span>}</td>
                    <td>{d.finalidade === 'DEVOLUCAO_COMPRA' ? 'Ao fornecedor' : 'Do cliente'}</td>
                    <td>{d.destinatarioNome}</td>
                    <td>{moeda(d.valorTotal)}</td>
                    <td>
                      <span className={`badge ${d.status === 'AUTORIZADA' ? 'badge-success' : d.status === 'CANCELADA' ? 'badge-neutral' : 'badge-danger'}`}>{d.status}</span>
                      {d.motivoErro && <div className="text-muted" style={{ fontSize: '0.75rem', maxWidth: 360 }}>{d.motivoErro}</div>}
                    </td>
                    <td>{d.status !== 'REJEITADA' && d.xmlNfe && <Link href={`/notas-fiscais/ver-danfe?id=${d.id}`} className="text-primary">DANFE</Link>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
