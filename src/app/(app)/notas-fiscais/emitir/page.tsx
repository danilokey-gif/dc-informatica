import { prisma } from "@/lib/prisma"
import Link from "next/link"

export const dynamic = 'force-dynamic'

// Pendências mais antigas que isso provavelmente já tiveram a nota emitida em outro lugar
// (portal do governo, emissor do Sebrae) e só poluiriam a lista.
const JANELA_DIAS = 120

const BRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const data = (d: Date) => d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })

/**
 * Ponto único para emitir nota fiscal. A emissão em si continua na tela da OS (NFS-e) e da venda
 * (NF-e), onde estão os dados da nota; esta tela só mostra o caminho para cada uma.
 */
export default async function EmitirNotaPage() {
  const desde = new Date(Date.now() - JANELA_DIAS * 864e5)
  const [osSemNota, vendasSemNota] = await Promise.all([
    prisma.serviceOrder.findMany({
      where: { status: { in: ['COMPLETED', 'DELIVERED'] }, price: { gt: 0 }, updatedAt: { gte: desde }, nfseEmissoes: { none: { status: 'AUTORIZADA' } } },
      select: { id: true, price: true, device: true, issue: true, updatedAt: true, customer: { select: { name: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    }),
    prisma.sale.findMany({
      // invoiceNumber preenchido = nota registrada à mão (emitida em outro emissor).
      where: { createdAt: { gte: desde }, invoiceNumber: null, nfeEmissoes: { none: { status: 'AUTORIZADA' } } },
      select: { id: true, total: true, createdAt: true, customer: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ])

  return (
    <div className="animate-fade-in">
      <div className="mb-4">
        <h2 style={{ margin: 0 }}>Emitir Nota Fiscal</h2>
        <p className="text-muted" style={{ fontSize: '0.9rem', margin: '0.35rem 0 0' }}>
          Escolha o tipo de nota. Serviço (conserto, formatação, manutenção) é <strong>NFS-e</strong>; venda de produto é <strong>NF-e</strong>.
        </p>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {/* ── Serviço ── */}
        <div className="card" style={{ borderTop: '4px solid var(--primary)' }}>
          <h3 style={{ margin: '0 0 0.25rem' }}>🧾 Nota de Serviço (NFS-e)</h3>
          <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>Para serviços prestados.</p>
          <div className="flex gap-4" style={{ flexWrap: 'wrap', marginBottom: '1.25rem' }}>
            <Link href="/os/rapida" className="btn btn-primary">+ Nova nota de serviço</Link>
            <Link href="/os/novo" className="btn btn-outline">Abrir uma OS</Link>
          </div>
          <Pendencias
            titulo="OS concluídas sem nota"
            vazio="Nenhuma OS concluída sem nota."
            itens={osSemNota.map(o => ({
              href: `/os/${o.id}/imprimir#nota-fiscal`,
              nome: o.customer.name,
              detalhe: [o.device, o.issue].filter(Boolean).join(' — '),
              data: data(o.updatedAt),
              valor: BRL(o.price ?? 0),
            }))}
          />
        </div>

        {/* ── Produto ── */}
        <div className="card" style={{ borderTop: '4px solid var(--primary)' }}>
          <h3 style={{ margin: '0 0 0.25rem' }}>📦 Nota de Produto (NF-e)</h3>
          <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>Para venda de mercadorias. A nota sai a partir da venda.</p>
          <div className="flex gap-4" style={{ flexWrap: 'wrap', marginBottom: '1.25rem' }}>
            <Link href="/vendas/novo" className="btn btn-primary">+ Nova venda com nota</Link>
          </div>
          <Pendencias
            titulo="Vendas sem nota"
            vazio="Nenhuma venda sem nota."
            itens={vendasSemNota.map(v => ({
              href: `/vendas/${v.id}/imprimir#nota-fiscal`,
              nome: v.customer?.name || 'Consumidor',
              detalhe: `Venda nº ${v.id.slice(-6).toUpperCase()}`,
              data: data(v.createdAt),
              valor: BRL(v.total),
            }))}
          />
        </div>
      </div>

      <p className="text-muted" style={{ fontSize: '0.78rem', marginTop: '1rem' }}>
        As listas mostram os últimos {JANELA_DIAS} dias. Se a nota de algum item já foi emitida em outro lugar (portal do governo,
        emissor do Sebrae), é só ignorar. Notas emitidas fora do sistema entram em <Link href="/notas-fiscais/importar-xml" className="text-primary">Importar XML</Link>.
      </p>
    </div>
  )
}

function Pendencias({ titulo, vazio, itens }: { titulo: string; vazio: string; itens: { href: string; nome: string; detalhe: string; data: string; valor: string }[] }) {
  return (
    <div>
      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
        {titulo} {itens.length > 0 && <span className="badge badge-warning" style={{ marginLeft: '0.35rem' }}>{itens.length}</span>}
      </div>
      {itens.length === 0 ? (
        <p className="text-muted" style={{ fontSize: '0.85rem', margin: 0 }}>{vazio}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {itens.map(i => (
            <Link key={i.href} href={i.href} className="pendencia-nota">
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.88rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{i.nome}</div>
                <div className="text-muted" style={{ fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{i.data} · {i.detalhe}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{i.valor}</div>
                <div className="text-primary" style={{ fontSize: '0.75rem' }}>Emitir →</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
