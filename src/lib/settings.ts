import { prisma } from "./prisma"

export async function getCompanySettings() {
  const settings = await prisma.companySettings.findUnique({ where: { id: 'main' } })
  if (settings) return settings

  return prisma.companySettings.create({
    data: { id: 'main', name: 'Dc Informática' }
  })
}
