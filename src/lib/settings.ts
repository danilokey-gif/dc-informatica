import { prisma } from "./prisma"

export async function getCompanySettings() {
  const settings = await prisma.companySettings.findUnique({ where: { id: 'main' } })
  if (settings) return settings

  return prisma.companySettings.create({
    data: { id: 'main', name: 'Dc Informática' }
  })
}

export async function getNfseConfig() {
  const config = await prisma.nfseConfig.findUnique({ where: { id: 'main' } })
  if (config) return config

  return prisma.nfseConfig.create({ data: { id: 'main' } })
}
