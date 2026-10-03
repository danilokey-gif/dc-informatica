import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { notFound } from "next/navigation"

export const dynamic = 'force-dynamic'

/**
 * Mostra o DANFSe v2.0 (NT 008/2026) gerado em PDF por /notas-fiscais/danfse-pdf. O documento é um
 * só: o mesmo PDF que vai por e-mail, para o Drive e para o .zip do período.
 */
export default async function VerDanfsePage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams
  if (!id) notFound()

  const emissao = await prisma.nfseEmissao.findUnique({
    where: { id },
    select: { id: true, xmlNfse: true, numeroDps: true, serviceOrderId: true, status: true },
  })
  if (!emissao) notFound()

  const voltar = emissao.serviceOrderId ? `/os/${emissao.serviceOrderId}/imprimir` : '/notas-fiscais'

  if (!emissao.xmlNfse) {
    return (
      <div className="animate-fade-in" style={{ maxWidth: '600px', margin: '2rem auto', textAlign: 'center' }}>
        <p>Esta nota não tem XML disponível para gerar o DANFSe.</p>
        <Link href={voltar} className="text-primary">Voltar</Link>
      </div>
    )
  }

  const numero = emissao.xmlNfse.match(/<nNFSe>(\d+)<\/nNFSe>/)?.[1] || String(emissao.numeroDps)
  const urlPdf = `/notas-fiscais/danfse-pdf?id=${emissao.id}`

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-4" style={{ flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: 0 }}>DANFSe — NFS-e nº {numero}</h2>
          <p className="text-muted" style={{ fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
            Modelo nacional DANFSe v2.0 (Nota Técnica SE/CGNFS-e nº 008/2026).
            {emissao.status === 'CANCELADA' && ' Nota cancelada.'}
          </p>
        </div>
        <div className="flex gap-4" style={{ alignItems: 'center' }}>
          <a href={`${urlPdf}&download=1`} className="btn btn-primary">⬇️ Baixar PDF</a>
          <a href={urlPdf} target="_blank" rel="noopener noreferrer" className="btn btn-outline">Abrir para imprimir</a>
          <Link href={voltar} className="text-muted">Voltar</Link>
        </div>
      </div>
      <iframe
        src={urlPdf}
        title={`DANFSe da NFS-e ${numero}`}
        style={{ width: '100%', height: 'calc(100vh - 180px)', minHeight: '600px', border: '1px solid var(--border)', borderRadius: '0.5rem', background: '#fff' }}
      />
    </div>
  )
}
