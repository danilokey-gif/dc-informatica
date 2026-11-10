import { prisma } from "@/lib/prisma"
import { getCompanySettings } from "@/lib/settings"
import { gerarDanfsePdf } from "@/lib/nfse/danfse"
import { gerarDanfePdf, logoDeDataUrl } from "@/lib/nfe/danfe"
import { lerTokenDaNota } from "@/lib/nota-whatsapp"

export const dynamic = 'force-dynamic'

/**
 * PDF da nota para o cliente abrir pelo link enviado no WhatsApp (sem login). Só abre com o link
 * assinado daquela nota, e só notas de verdade (produção, autorizadas ou canceladas).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const nota = lerTokenDaNota((await params).token)
  const naoAchou = () => new Response('Nota não encontrada. Peça um novo link a quem enviou.', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  if (!nota) return naoAchou()

  let pdf: Buffer, arquivo: string
  if (nota.tipo === 'nfse') {
    const e = await prisma.nfseEmissao.findUnique({ where: { id: nota.id }, select: { xmlNfse: true, status: true, ambiente: true, numeroDps: true } })
    if (!e?.xmlNfse || e.ambiente !== 'producao' || !['AUTORIZADA', 'CANCELADA'].includes(e.status)) return naoAchou()
    pdf = await gerarDanfsePdf(e.xmlNfse, { cancelada: e.status === 'CANCELADA' })
    arquivo = `NFS-e-${e.xmlNfse.match(/<nNFSe>(\d+)<\/nNFSe>/)?.[1] || e.numeroDps}.pdf`
  } else {
    const [e, empresa] = await Promise.all([
      prisma.nfeEmissao.findUnique({ where: { id: nota.id }, select: { xmlNfe: true, xmlProtocolo: true, status: true, ambiente: true, numero: true } }),
      getCompanySettings(),
    ])
    if (!e?.xmlNfe || e.ambiente !== 'producao' || !['AUTORIZADA', 'CANCELADA'].includes(e.status)) return naoAchou()
    pdf = await gerarDanfePdf(e.xmlNfe, { xmlProtocolo: e.xmlProtocolo, cancelada: e.status === 'CANCELADA', logo: logoDeDataUrl(empresa.logo) })
    arquivo = `NF-e-${e.numero}.pdf`
  }

  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${arquivo}"`,
      'X-Robots-Tag': 'noindex, nofollow',
      'Cache-Control': 'private, no-store',
    },
  })
}
