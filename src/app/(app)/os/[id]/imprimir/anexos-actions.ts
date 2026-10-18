'use server'

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth"
import { dadosDoArquivo, iniciarUploadResumivel, moverParaLixeira, pastaPorCaminho, tokenDoUsuario } from "@/lib/google-drive-usuario"

const TIPOS_ACEITOS = /^(image|video)\//
const TAMANHO_MAXIMO = 2_000_000_000 // 2 GB por arquivo

function pastaDaOs(os: { id: string; customer: { name: string } }) {
  return ['Ordens de Serviço', `OS ${os.id.slice(-6).toUpperCase()} - ${os.customer.name}`.replace(/[\\/:*?"<>|]/g, '-').slice(0, 120)]
}

/**
 * Primeiro passo do envio: cria a pasta da OS no Drive e abre a sessão de upload. O navegador
 * manda o arquivo direto para o Google com o endereço devolvido aqui.
 */
export async function iniciarEnvioAnexo(serviceOrderId: string, arquivo: { nome: string; mimeType: string; tamanho: number; sha256?: string }): Promise<{ url?: string; erro?: string }> {
  try {
    const usuario = await getCurrentUser()
    if (!usuario) return { erro: 'Sessão expirada. Entre no sistema de novo.' }
    if (!TIPOS_ACEITOS.test(arquivo.mimeType)) return { erro: `"${arquivo.nome}" não é foto nem vídeo.` }
    if (arquivo.tamanho <= 0 || arquivo.tamanho > TAMANHO_MAXIMO) return { erro: `"${arquivo.nome}" passa de 2 GB.` }

    if (arquivo.sha256) {
      const igual = await prisma.osAnexo.findFirst({ where: { serviceOrderId, sha256: arquivo.sha256.toLowerCase(), excluidoEm: null } })
      if (igual) {
        return { erro: `"${arquivo.nome}" já está nesta OS (enviado em ${igual.createdAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}).` }
      }
    }
    const os = await prisma.serviceOrder.findUniqueOrThrow({ where: { id: serviceOrderId }, include: { customer: { select: { name: true } } } })
    const token = await tokenDoUsuario()
    const pastaId = await pastaPorCaminho(token, pastaDaOs(os))
    const h = await headers()
    const origem = `${h.get('x-forwarded-proto') || 'https'}://${h.get('host')}`
    const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    const url = await iniciarUploadResumivel(token, {
      nome: arquivo.nome,
      mimeType: arquivo.mimeType,
      tamanho: arquivo.tamanho,
      pastaId,
      origem,
      descricao: `OS ${os.id.slice(-6).toUpperCase()} - ${os.customer.name}. Enviado por ${usuario.name} em ${agora}.`,
    })
    return { url }
  } catch (e: any) {
    console.error('[Anexos OS] iniciar envio:', e)
    return { erro: e.message || 'Não consegui iniciar o envio.' }
  }
}

/**
 * Segundo passo: o arquivo já está no Drive. Confere no Google que ele está na pasta desta OS e
 * que o SHA-256 bate com o calculado no navegador antes do envio, e só então registra.
 */
export async function confirmarAnexo(serviceOrderId: string, dados: { driveFileId: string; sha256: string; descricao?: string }): Promise<{ ok?: boolean; erro?: string }> {
  try {
    const usuario = await getCurrentUser()
    if (!usuario) return { erro: 'Sessão expirada. Entre no sistema de novo.' }
    const os = await prisma.serviceOrder.findUniqueOrThrow({ where: { id: serviceOrderId }, include: { customer: { select: { name: true } } } })
    const token = await tokenDoUsuario()
    const pastaId = await pastaPorCaminho(token, pastaDaOs(os))
    const arq = await dadosDoArquivo(token, dados.driveFileId)

    if (!arq.parents?.includes(pastaId)) return { erro: 'O arquivo enviado não está na pasta desta OS.' }
    if (!TIPOS_ACEITOS.test(arq.mimeType)) return { erro: 'O arquivo enviado não é foto nem vídeo.' }
    const sha = dados.sha256.toLowerCase()
    if (arq.sha256Checksum && arq.sha256Checksum.toLowerCase() !== sha) {
      return { erro: `O arquivo "${arq.name}" chegou diferente do original (SHA-256 não confere). Envie de novo.` }
    }

    await prisma.osAnexo.create({
      data: {
        serviceOrderId,
        driveFileId: arq.id,
        nome: arq.name,
        mimeType: arq.mimeType,
        tamanho: Number(arq.size || 0),
        sha256: sha,
        descricao: dados.descricao?.trim() || null,
        enviadoPor: usuario.name,
      },
    })
    revalidatePath(`/os/${serviceOrderId}/imprimir`)
    return { ok: true }
  } catch (e: any) {
    console.error('[Anexos OS] confirmar:', e)
    return { erro: e.message || 'Não consegui registrar o arquivo.' }
  }
}

/**
 * Apaga uma foto/vídeo da OS: some da tela e o arquivo vai para a lixeira do Google Drive
 * (recuperável por 30 dias). O registro fica no banco com quem apagou e quando.
 */
export async function excluirAnexo(anexoId: string): Promise<{ ok?: boolean; erro?: string }> {
  try {
    const usuario = await getCurrentUser()
    if (!usuario) return { erro: 'Sessão expirada. Entre no sistema de novo.' }
    const anexo = await prisma.osAnexo.findUnique({ where: { id: anexoId } })
    if (!anexo || anexo.excluidoEm) return { ok: true }
    try {
      await moverParaLixeira(await tokenDoUsuario(), anexo.driveFileId)
    } catch (e: any) {
      // Já apagado direto no Drive: segue e só tira da OS.
      if (!String(e.message).includes('404')) throw e
    }
    await prisma.osAnexo.update({ where: { id: anexoId }, data: { excluidoEm: new Date(), excluidoPor: usuario.name } })
    revalidatePath(`/os/${anexo.serviceOrderId}`)
    revalidatePath(`/os/${anexo.serviceOrderId}/imprimir`)
    return { ok: true }
  } catch (e: any) {
    console.error('[Anexos OS] excluir:', e)
    return { erro: e.message || 'Não consegui apagar o arquivo.' }
  }
}
