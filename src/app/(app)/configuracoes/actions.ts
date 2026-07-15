'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { encryptSecret } from "@/lib/crypto"
import { extractCertMaterial } from "@/lib/nfse/certificate"

const MAX_LOGO_SIZE = 1_500_000 // ~1.5MB, suficiente para um logo em base64
const MAX_CERT_SIZE = 20_000 // certificados A1 costumam ter poucos KB

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

export async function updateNfseConfig(formData: FormData) {
  const ambiente = (formData.get('ambiente') as string) || 'homologacao'
  const codigoMunicipio = (formData.get('codigoMunicipio') as string) || null
  const codigoServico = (formData.get('codigoServico') as string) || null
  const cnae = (formData.get('cnae') as string) || null
  const aliquotaIssRaw = formData.get('aliquotaIss') as string
  const aliquotaIss = aliquotaIssRaw ? parseFloat(aliquotaIssRaw) : null
  const serieDps = (formData.get('serieDps') as string) || '1'
  const removeCertificado = formData.get('removeCertificado') === '1'
  const certFile = formData.get('certificado') as File | null
  const certSenha = formData.get('certificadoSenha') as string

  const data: {
    ambiente: string
    codigoMunicipio: string | null
    codigoServico: string | null
    cnae: string | null
    aliquotaIss: number | null
    serieDps: string
    certificado?: string | null
    certificadoSenha?: string | null
    certificadoNome?: string | null
  } = { ambiente, codigoMunicipio, codigoServico, cnae, aliquotaIss, serieDps }

  if (removeCertificado) {
    data.certificado = null
    data.certificadoSenha = null
    data.certificadoNome = null
  } else if (certFile && certFile.size > 0) {
    if (certFile.size > MAX_CERT_SIZE) {
      throw new Error('Arquivo de certificado maior do que o esperado para um .pfx. Confira o arquivo enviado.')
    }
    if (!certSenha) {
      throw new Error('Informe a senha do certificado para poder validá-lo.')
    }
    const buffer = Buffer.from(await certFile.arrayBuffer())
    // Valida o certificado e a senha antes de salvar (lança erro se a senha estiver errada).
    extractCertMaterial(buffer, certSenha)

    data.certificado = buffer.toString('base64')
    data.certificadoSenha = encryptSecret(certSenha)
    data.certificadoNome = certFile.name
  } else if (certSenha) {
    // Trocou só a senha, mantendo o certificado já enviado.
    data.certificadoSenha = encryptSecret(certSenha)
  }

  await prisma.nfseConfig.upsert({
    where: { id: 'main' },
    create: { id: 'main', ...data },
    update: data
  })

  revalidatePath('/configuracoes')
  redirect('/configuracoes')
}
