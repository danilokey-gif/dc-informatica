import { prisma } from "@/lib/prisma"

export const dynamic = 'force-dynamic'

/**
 * Logo da empresa como imagem, para o navegador guardar em cache. Antes o logo (data URL de
 * ~110 KB) ia embutido no HTML de todas as páginas pela barra lateral.
 * O parâmetro ?v= muda quando as configurações mudam, então um logo novo aparece na hora.
 */
export async function GET() {
  const s = await prisma.companySettings.findUnique({ where: { id: 'main' }, select: { logo: true } })
  const m = s?.logo?.match(/^data:(image\/[a-z+.-]+);base64,(.+)$/)
  if (!m) return new Response(null, { status: 404 })
  return new Response(Buffer.from(m[2], 'base64'), {
    headers: { 'Content-Type': m[1], 'Cache-Control': 'private, max-age=31536000, immutable' },
  })
}
