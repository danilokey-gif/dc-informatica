import { prisma } from "@/lib/prisma"
import Link from "next/link"
import StatusBadge from "@/components/StatusBadge"

const BRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const data = (d: Date) => d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
const anoBr = (d: Date) => new Date(d.getTime() - 3 * 3600_000).getUTCFullYear()

interface Nota {
  id: string
  tipo: 'NFS-e' | 'NF-e'
  numero: string
  data: Date
  valor: number
  status: string
  descricao: string
  pagamento: string
  linkPdf: string
  linkXml: string
  devolucao: boolean
}

/**
 * Notas fiscais (NFS-e e NF-e, produção) emitidas para o cliente: pelo CPF/CNPJ da nota ou pela
 * OS/venda dele. Mostra quanto foi faturado por ano e se cada nota já foi paga.
 */
export default async function NotasCliente({ clienteId, documento }: { clienteId: string; documento: string | null }) {
  const doc = (documento || '').replace(/\D/g, '')
  const porDoc = doc.length >= 11

  const [servicos, produtos] = await Promise.all([
    prisma.nfseEmissao.findMany({
      where: {
        ambiente: 'producao', status: { in: ['AUTORIZADA', 'CANCELADA'] },
        OR: [{ serviceOrder: { customerId: clienteId } }, ...(porDoc ? [{ tomadorDocumento: doc }] : [])],
      },
      select: { id: true, numeroNfse: true, numeroDps: true, dataEmissao: true, createdAt: true, valorTotal: true, status: true, chaveAcesso: true, serviceOrderId: true, xmlNfse: true },
    }),
    prisma.nfeEmissao.findMany({
      where: {
        ambiente: 'producao', status: { in: ['AUTORIZADA', 'CANCELADA'] },
        OR: [{ sale: { customerId: clienteId } }, ...(porDoc ? [{ destinatarioDocumento: doc }] : [])],
      },
      select: { id: true, numero: true, serie: true, dataEmissao: true, createdAt: true, valorTotal: true, status: true, chaveAcesso: true, saleId: true, finalidade: true, xmlNfe: true },
    }),
  ])

  // Recebimentos ligados a cada nota (pela chave anotada, pela OS ou pela venda).
  const chaves = [...servicos, ...produtos].map(n => n.chaveAcesso).filter((c): c is string => !!c)
  const receitas = await prisma.financeTransaction.findMany({
    where: {
      type: 'RECEITA', status: { not: 'CANCELADO' },
      OR: [
        ...chaves.map(c => ({ notes: { contains: c } })),
        { serviceOrderId: { in: servicos.map(s => s.serviceOrderId).filter((x): x is string => !!x) } },
        { saleId: { in: produtos.map(p => p.saleId).filter((x): x is string => !!x) } },
      ],
    },
    select: { amount: true, status: true, paidDate: true, paymentMethod: true, notes: true, serviceOrderId: true, saleId: true },
  })
  const pagamentoDe = (chave: string | null, osId?: string | null, vendaId?: string | null) => {
    const rs = receitas.filter(r => (chave && r.notes?.includes(chave)) || (osId && r.serviceOrderId === osId) || (vendaId && r.saleId === vendaId))
    if (rs.length === 0) return '—'
    const pagas = rs.filter(r => r.status === 'PAGO'), abertas = rs.filter(r => r.status === 'PENDENTE')
    if (abertas.length === 0) {
      const ultima = pagas.map(r => r.paidDate).filter((d): d is Date => !!d).sort((a, b) => b.getTime() - a.getTime())[0]
      const forma = [...new Set(pagas.map(r => r.paymentMethod === 'Transferência/Bancário' ? 'Pix/banco' : r.paymentMethod).filter(Boolean))].join(', ')
      return `Pago${ultima ? ` em ${data(ultima)}` : ''}${forma ? ` · ${forma}` : ''}`
    }
    return `${pagas.length ? `${pagas.length} pago(s), ` : ''}${abertas.length} a receber (${BRL(abertas.reduce((s, r) => s + r.amount, 0))})`
  }

  const notas: Nota[] = [
    ...servicos.map(n => ({
      id: n.id, tipo: 'NFS-e' as const, numero: String(n.numeroNfse ?? n.numeroDps), data: n.dataEmissao || n.createdAt,
      valor: n.valorTotal ?? 0, status: n.status,
      descricao: (n.xmlNfse?.match(/<xDescServ>([^<]*)<\/xDescServ>/)?.[1] || '').replace(/\s+/g, ' ').slice(0, 140),
      pagamento: n.status === 'CANCELADA' ? '—' : pagamentoDe(n.chaveAcesso, n.serviceOrderId),
      linkPdf: `/notas-fiscais/ver-danfse?id=${n.id}`, linkXml: `/notas-fiscais/ver-xml?tipo=nfse&id=${n.id}`, devolucao: false,
    })),
    ...produtos.map(n => ({
      id: n.id, tipo: 'NF-e' as const, numero: `${n.numero}/${n.serie}`, data: n.dataEmissao || n.createdAt,
      valor: n.valorTotal ?? 0, status: n.status,
      descricao: [...(n.xmlNfe || '').matchAll(/<xProd>([^<]*)<\/xProd>/g)].map(m => m[1]).join('; ').slice(0, 140),
      pagamento: n.status === 'CANCELADA' || n.finalidade !== 'VENDA' ? '—' : pagamentoDe(n.chaveAcesso, null, n.saleId),
      linkPdf: `/notas-fiscais/ver-danfe?id=${n.id}`, linkXml: `/notas-fiscais/ver-xml?tipo=nfe&id=${n.id}`, devolucao: n.finalidade !== 'VENDA',
    })),
  ].sort((a, b) => b.data.getTime() - a.data.getTime())

  const validas = notas.filter(n => n.status === 'AUTORIZADA' && !n.devolucao)
  const anos = [...new Set(validas.map(n => anoBr(n.data)))].sort((a, b) => b - a)

  return (
    <div className="card" style={{ marginTop: '1.5rem' }}>
      <div className="flex justify-between items-center" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
        <h3 style={{ margin: 0 }}>Notas fiscais emitidas</h3>
        <span className="text-muted" style={{ fontSize: '0.85rem' }}>
          {validas.length} nota(s) · {BRL(validas.reduce((s, n) => s + n.valor, 0))}
        </span>
      </div>
      {!porDoc && <p className="text-muted" style={{ fontSize: '0.8rem' }}>Cliente sem CPF/CNPJ no cadastro: aparecem só as notas das OS e vendas dele.</p>}

      {anos.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', margin: '0.75rem 0 1rem' }}>
          {anos.map(a => {
            const doAno = validas.filter(n => anoBr(n.data) === a)
            const serv = doAno.filter(n => n.tipo === 'NFS-e'), prod = doAno.filter(n => n.tipo === 'NF-e')
            return (
              <div key={a} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '0.5rem 0.75rem' }}>
                <div className="text-muted" style={{ fontSize: '0.72rem' }}>{a}</div>
                <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{BRL(doAno.reduce((s, n) => s + n.valor, 0))}</div>
                <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                  {serv.length > 0 && `${serv.length} serviço`}{serv.length > 0 && prod.length > 0 && ' · '}{prod.length > 0 && `${prod.length} produto`}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {notas.length === 0 ? (
        <p className="text-muted">Nenhuma nota fiscal emitida para este cliente.</p>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr><th>Data</th><th>Nota</th><th>Serviço / produtos</th><th style={{ textAlign: 'right' }}>Valor</th><th>Pagamento</th><th></th></tr>
            </thead>
            <tbody>
              {notas.map(n => (
                <tr key={`${n.tipo}-${n.id}`} style={n.status === 'CANCELADA' ? { opacity: 0.55 } : undefined}>
                  <td style={{ whiteSpace: 'nowrap' }}>{data(n.data)}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <strong>{n.tipo} {n.numero}</strong>
                    {n.status === 'CANCELADA' && <div><StatusBadge status="CANCELADA" /></div>}
                    {n.devolucao && <div className="text-muted" style={{ fontSize: '0.72rem' }}>Devolução</div>}
                  </td>
                  <td style={{ fontSize: '0.85rem' }}>{n.descricao || '—'}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap', textDecoration: n.status === 'CANCELADA' ? 'line-through' : undefined }}>{BRL(n.valor)}</td>
                  <td style={{ fontSize: '0.8rem' }}>{n.pagamento}</td>
                  <td style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                    <Link href={n.linkPdf} className="text-primary">{n.tipo === 'NFS-e' ? 'DANFSe' : 'DANFE'}</Link>
                    {' · '}
                    <Link href={n.linkXml} className="text-muted">XML</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
