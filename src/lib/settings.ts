import { prisma } from "./prisma"

export async function getCompanySettings() {
  const settings = await prisma.companySettings.findUnique({ where: { id: 'main' } })
  if (settings) return settings

  return prisma.companySettings.create({
    data: { id: 'main', name: 'Dc Informática' }
  })
}

/**
 * Só o que o layout usa em toda página. Não carrega o logo (data URL grande) nem os campos do
 * certificado: o logo vai pela rota /logo, com cache no navegador.
 */
export async function getCompanySettingsLeve() {
  const [s] = await prisma.$queryRaw<{ name: string; nomeFantasia: string | null; phone: string | null; updatedAt: Date; temLogo: boolean }[]>`
    SELECT "name", "nomeFantasia", "phone", "updatedAt", ("logo" IS NOT NULL AND "logo" <> '') AS "temLogo"
    FROM "CompanySettings" WHERE "id" = 'main'`
  if (s) return s
  const criada = await getCompanySettings()
  return { name: criada.name, nomeFantasia: criada.nomeFantasia, phone: criada.phone, updatedAt: criada.updatedAt, temLogo: !!criada.logo }
}

export async function getNfseConfig() {
  const config = await prisma.nfseConfig.findUnique({ where: { id: 'main' } })
  if (config) return config

  return prisma.nfseConfig.create({ data: { id: 'main' } })
}

export async function getNfeConfig() {
  const config = await prisma.nfeConfig.findUnique({ where: { id: 'main' } })
  if (config) return config

  return prisma.nfeConfig.create({ data: { id: 'main' } })
}
