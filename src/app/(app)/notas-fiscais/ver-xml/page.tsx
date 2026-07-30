import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { notFound } from "next/navigation"

export const dynamic = 'force-dynamic'

/** Indenta um XML compacto (sem quebras de linha) pra ficar legível na tela. */
function formatarXml(xml: string): string {
  const semQuebras = xml.replace(/>\s*</g, '><').trim()
  let indentado = ''
  let nivel = 0
  const tokens = semQuebras.split(/(?=<)/g)

  for (const token of tokens) {
    if (!token) continue
    const fechamento = /^<\/[^>]+>/.test(token)
    const autoFechado = /\/>\s*$/.test(token)
    const declaracao = /^<\?/.test(token)

    if (fechamento) nivel = Math.max(0, nivel - 1)
    indentado += '  '.repeat(nivel) + token + '\n'
    if (!fechamento && !autoFechado && !declaracao) nivel++
  }

  return indentado.trim()
}

export default async function VerXmlPage({ searchParams }: { searchParams: Promise<{ tipo?: string; id?: string }> }) {
  const { tipo, id } = await searchParams

  if (!id || (tipo !== 'nfse' && tipo !== 'nfe')) notFound()

  let xml: string | null = null
  let titulo = ''
  let chaveAcesso: string | null = null
  let voltarHref = '/notas-fiscais'

  if (tipo === 'nfse') {
    const emissao = await prisma.nfseEmissao.findUnique({ where: { id } })
    if (!emissao) notFound()
    xml = emissao.xmlNfse
    chaveAcesso = emissao.chaveAcesso
    titulo = `NFS-e nº ${emissao.numeroDps} / série ${emissao.serieDps}`
    if (emissao.serviceOrderId) voltarHref = `/os/${emissao.serviceOrderId}/imprimir`
  } else {
    const emissao = await prisma.nfeEmissao.findUnique({ where: { id } })
    if (!emissao) notFound()
    xml = emissao.xmlNfe
    chaveAcesso = emissao.chaveAcesso
    titulo = `NF-e nº ${emissao.numero} / série ${emissao.serie}`
    if (emissao.saleId) voltarHref = `/vendas/${emissao.saleId}/imprimir`
  }

  if (!xml) {
    return (
      <div className="animate-fade-in" style={{ maxWidth: '600px', margin: '2rem auto', textAlign: 'center' }}>
        <p>Esta nota ainda não tem XML disponível.</p>
        <Link href={voltarHref} className="text-primary">Voltar</Link>
      </div>
    )
  }

  const xmlFormatado = formatarXml(xml)

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 style={{ marginBottom: '0.25rem' }}>{titulo}</h2>
          {chaveAcesso && <p className="text-muted" style={{ fontSize: '0.85rem', fontFamily: 'monospace' }}>{chaveAcesso}</p>}
        </div>
        <div className="flex gap-4">
          <a href={`/notas-fiscais/xml?tipo=${tipo}&id=${id}`} className="btn btn-outline">⬇️ Baixar .xml</a>
          <Link href={voltarHref} className="text-muted">Voltar</Link>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <pre style={{
          margin: 0,
          padding: '1.25rem',
          overflowX: 'auto',
          fontSize: '0.8rem',
          lineHeight: 1.5,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          color: 'var(--text-main)',
          maxHeight: '75vh',
          overflowY: 'auto',
        }}>
          {xmlFormatado}
        </pre>
      </div>
    </div>
  )
}
