'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

const MAX_LOGO_SIZE = 1_500_000 // ~1.5MB, suficiente para um logo em base64

export async function updateSettings(formData: FormData) {
  const name = formData.get('name') as string
  const document = (formData.get('document') as string) || null
  const phone = (formData.get('phone') as string) || null
  const email = (formData.get('email') as string) || null
  const address = (formData.get('address') as string) || null
  const removeLogo = formData.get('removeLogo') === '1'
  const logoFile = formData.get('logo') as File | null

  let logo: string | null | undefined = undefined

  if (removeLogo) {
    logo = null
  } else if (logoFile && logoFile.size > 0) {
    if (logoFile.size > MAX_LOGO_SIZE) {
      throw new Error('Logo muito grande. Envie uma imagem de até 1.5MB.')
    }
    if (!logoFile.type.startsWith('image/')) {
      throw new Error('Envie um arquivo de imagem válido (PNG, JPG, etc).')
    }
    const buffer = await logoFile.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    logo = `data:${logoFile.type};base64,${base64}`
  }

  await prisma.companySettings.upsert({
    where: { id: 'main' },
    create: { id: 'main', name, document, phone, email, address, logo: logo ?? undefined },
    update: { name, document, phone, email, address, ...(logo !== undefined ? { logo } : {}) }
  })

  revalidatePath('/', 'layout')
  redirect('/configuracoes')
}
