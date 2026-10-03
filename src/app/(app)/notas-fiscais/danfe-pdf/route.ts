import { prisma } from "@/lib/prisma"
import { getCompanySettings } from "@/lib/settings"
import { gerarDanfePdf, logoDeDataUrl } from "@/lib/nfe/danfe"
import { NextRequest } from "next/server"

export const dynamic = 'force-dynamic'

/**
 * PDF do DANFE (modelo da NT 2026.010), montado a partir do XML da NF-e. ?origem=recebida abre uma
 * nota de compra (só com XML completo); ?download=1 baixa o arquivo.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return new Response('Informe a nota.', { status: 400 })

  let xml: string | null = null
  let xmlProtocolo: string | null = null
  let cancelada = false
  let logo: Buffer | null = null
  if (searchParams.get('origem') === 'recebida') {
    const nota = await prisma.nfeRecebida.findUnique({ where: { id }, select: { xml: true, completa: true, situacao: true } })
    if (nota?.completa) { xml = nota.xml; cancelada = nota.situacao === '3' }
  } else {
    const [emissao, empresa] = await Promise.all([
      prisma.nfeEmissao.findUnique({ where: { id }, select: { xmlNfe: true, xmlProtocolo: true, status: true, origem: true } }),
      getCompanySettings(),
    ])
    if (emissao) {
      xml = emissao.xmlNfe
      xmlProtocolo = emissao.xmlProtocolo
      cancelada = emissao.status === 'CANCELADA'
      // O logo é o da própria empresa: só nas notas que ela emitiu.
      logo = logoDeDataUrl(empresa.logo)
    }
  }
  if (!xml) return new Response('Esta nota não tem XML completo para gerar o DANFE.', { status: 404 })

  const pdf = await gerarDanfePdf(xml, { xmlProtocolo, cancelada, logo })
  const numero = xml.match(/<nNF>(\d+)<\/nNF>/)?.[1] || id
  const disposicao = searchParams.get('download') ? 'attachment' : 'inline'
  return new Response(new Uint8Array(pdf), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `${disposicao}; filename="DANFE-${numero}.pdf"` },
  })
}
