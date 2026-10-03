import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { notFound } from "next/navigation"
import { INICIO_DANFE_RTC } from "@/lib/nfe/danfe"

export const dynamic = 'force-dynamic'

/**
 * Mostra o DANFE gerado em PDF por /notas-fiscais/danfe-pdf, a partir do XML. É o mesmo PDF que
 * vai por e-mail, para o Drive e para o .zip do período.
 */
export default async function VerDanfePage({ searchParams }: { searchParams: Promise<{ id?: string; origem?: string }> }) {
  const { id, origem } = await searchParams
  if (!id) notFound()
  const recebida = origem === 'recebida'

  const nota = recebida
    ? await prisma.nfeRecebida.findUnique({ where: { id }, select: { completa: true, numero: true } })
        .then(r => r && { temXml: r.completa, numero: String(r.numero ?? ''), voltar: '/notas-fiscais/fornecedores' })
    : await prisma.nfeEmissao.findUnique({ where: { id }, select: { xmlNfe: true, numero: true, saleId: true } })
        .then(e => e && { temXml: !!e.xmlNfe, numero: String(e.numero), voltar: e.saleId ? `/vendas/${e.saleId}/imprimir` : '/notas-fiscais' })
  if (!nota) notFound()

  if (!nota.temXml) {
    return (
      <div className="animate-fade-in" style={{ maxWidth: '600px', margin: '2rem auto', textAlign: 'center' }}>
        <p>Esta nota não tem XML completo para gerar o DANFE.</p>
        <Link href={nota.voltar} className="text-primary">Voltar</Link>
      </div>
    )
  }

  const urlPdf = `/notas-fiscais/danfe-pdf?id=${id}${recebida ? '&origem=recebida' : ''}`
  const modelo = new Date() >= INICIO_DANFE_RTC
    ? 'Modelo da Reforma Tributária (NT 2026.010).'
    : 'Modelo atual. O modelo da Reforma Tributária (NT 2026.010) entra sozinho em 01/12/2026.'

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-4" style={{ flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: 0 }}>DANFE — NF-e nº {nota.numero}</h2>
          <p className="text-muted" style={{ fontSize: '0.8rem', margin: '0.25rem 0 0' }}>{modelo}</p>
        </div>
        <div className="flex gap-4" style={{ alignItems: 'center' }}>
          <a href={`${urlPdf}&download=1`} className="btn btn-primary">⬇️ Baixar PDF</a>
          <a href={urlPdf} target="_blank" rel="noopener noreferrer" className="btn btn-outline">Abrir para imprimir</a>
          <Link href={nota.voltar} className="text-muted">Voltar</Link>
        </div>
      </div>
      <iframe
        src={urlPdf}
        title={`DANFE da NF-e ${nota.numero}`}
        style={{ width: '100%', height: 'calc(100vh - 180px)', minHeight: '600px', border: '1px solid var(--border)', borderRadius: '0.5rem', background: '#fff' }}
      />
    </div>
  )
}
