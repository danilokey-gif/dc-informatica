'use server'

import { prisma } from "@/lib/prisma"
import { getCompanySettings, getNfseConfig } from "@/lib/settings"
import { decryptSecret } from "@/lib/crypto"
import { extractCertMaterial } from "@/lib/nfse/certificate"
import { NfseClient } from "@/lib/nfse/client"
import { montarXmlPedRegEventoCancelamento, assinarPedRegEvento } from "@/lib/nfse/evento"
import { enviarEmail } from "@/lib/email"
import { revalidatePath } from "next/cache"
import { emitirNfseDaOs } from "@/lib/nfse/emitir-os"
import { gerarDanfsePdf } from "@/lib/nfse/danfse"
import fs from 'fs'
import path from 'path'
import { moverNotaNoGoogleDriveCancelada } from "@/lib/drive"

export async function emitirNfseServiceOrder(serviceOrderId: string) {
  // O fluxo de emissão mora em src/lib/nfse/emitir-os.ts, compartilhado com a cobrança mensal.
  // Erros ficam registrados na própria emissão (status REJEITADA + motivo), que a tela mostra.
  await emitirNfseDaOs(serviceOrderId)
  revalidatePath(`/os/${serviceOrderId}/imprimir`)
}

export async function enviarNfseEmail(serviceOrderId: string) {
  const [os, empresa, emissao] = await Promise.all([
    prisma.serviceOrder.findUniqueOrThrow({ where: { id: serviceOrderId }, include: { customer: true } }),
    getCompanySettings(),
    prisma.nfseEmissao.findFirst({ where: { serviceOrderId, status: 'AUTORIZADA' }, orderBy: { createdAt: 'desc' } }),
  ])

  if (!os.customer.email) {
    throw new Error('Cliente não tem e-mail cadastrado. Edite o cliente para adicionar um.')
  }
  if (!emissao) {
    throw new Error('Nenhuma NFS-e autorizada encontrada para esta OS.')
  }

  const valor = os.price ? os.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : ''
  
  if (!emissao.xmlNfse) {
    throw new Error('A NFS-e não tem XML para gerar o DANFSe.')
  }
  // DANFSe v2.0 (NT 008/2026), montado do XML da própria nota.
  const pdfBuffer = await gerarDanfsePdf(emissao.xmlNfse)

  await enviarEmail({
    to: os.customer.email,
    subject: `Nota Fiscal de Serviço - ${empresa.name}`,
    html: `
      <p>Olá, ${os.customer.name}!</p>
      <p>Segue a Nota Fiscal de Serviço referente ao atendimento${os.device ? ` do seu ${os.device}` : ''}.</p>
      <p><strong>Chave de acesso:</strong> ${emissao.chaveAcesso}</p>
      ${valor ? `<p><strong>Valor:</strong> ${valor}</p>` : ''}
      <p><strong>Ambiente:</strong> ${emissao.ambiente === 'producao' ? 'Produção' : 'Homologação (sem valor fiscal)'}</p>
      <p>Qualquer dúvida, entre em contato conosco.</p>
      <p>${empresa.name}${empresa.phone ? ` - ${empresa.phone}` : ''}</p>
    `,
    logoDataUrl: empresa.logo,
    arquivos: [
      ...(emissao.xmlNfse ? [{
        filename: `NFSe-${emissao.chaveAcesso}.xml`,
        content: emissao.xmlNfse,
        contentType: 'application/xml',
      }] : []),
      {
        filename: `DANFSe-${emissao.chaveAcesso}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      }
    ],
  })

  revalidatePath(`/os/${serviceOrderId}/imprimir`)
}

export async function cancelarNfseServiceOrder(serviceOrderId: string, formData: FormData) {
  const cMotivo = (formData.get('cMotivo') as string) || '9'
  const xMotivo = (formData.get('xMotivo') as string) || 'Cancelamento solicitado pelo prestador'

  try {
    const [emissao, empresa, nfseConfig] = await Promise.all([
      prisma.nfseEmissao.findFirst({ where: { serviceOrderId, status: 'AUTORIZADA' }, orderBy: { createdAt: 'desc' } }),
      getCompanySettings(),
      getNfseConfig(),
    ])

    if (!emissao) {
      throw new Error('Nenhuma nota fiscal de serviço autorizada encontrada para cancelar.')
    }
    if (!emissao.chaveAcesso) {
      throw new Error('Esta NFS-e não tem chave de acesso registrada, não é possível cancelar.')
    }
    if (!nfseConfig.certificado || !nfseConfig.certificadoSenha) {
      throw new Error('Certificado digital não configurado. Vá em Configurações > Nota Fiscal de Serviço.')
    }
    if (!empresa.document) {
      throw new Error('CNPJ/CPF da empresa não configurado.')
    }

    const pfxBuffer = Buffer.from(nfseConfig.certificado, 'base64')
    const certSenha = decryptSecret(nfseConfig.certificadoSenha)
    const certMaterial = extractCertMaterial(pfxBuffer, certSenha)
    const ambiente = emissao.ambiente === 'producao' ? 'producao' : 'homologacao'

    const { xml, id } = montarXmlPedRegEventoCancelamento({
      ambiente,
      chaveAcesso: emissao.chaveAcesso,
      documentoAutor: empresa.document,
      cMotivo: (cMotivo as '1' | '2' | '9'),
      xMotivo,
    })
    const xmlAssinado = assinarPedRegEvento(xml, id, certMaterial)

    await prisma.nfseEmissao.update({
      where: { id: emissao.id },
      data: { xmlPedRegEventoCancel: xmlAssinado, motivoCancelamento: xMotivo }
    })

    const client = new NfseClient({ ambiente, pfxBuffer, certPassword: certSenha })
    const { xmlEvento } = await client.registrarEvento(emissao.chaveAcesso, xmlAssinado)

    // 1. Atualizar o status no banco de dados para CANCELADA, só depois de confirmado pelo governo
    await prisma.nfseEmissao.update({
      where: { id: emissao.id },
      data: { status: 'CANCELADA', xmlEventoCancelamento: xmlEvento }
    })

    // 2. Mover os arquivos no drive local para a pasta Canceladas
    try {
      const empresa = await prisma.companySettings.findUnique({ where: { id: 'main' } })
      const baseDir = empresa?.localDrivePath || 'C:\\dc-informatica-corrigido_1\\arquivos_notas'
      const nfseFolder = path.join(baseDir, 'NFSe')
      
      const key = emissao.chaveAcesso || String(emissao.numeroDps)
      const xmlName = `${key}.xml`
      const pdfName = `${key}.pdf`
      
      const cancelFolder = path.join(nfseFolder, 'Canceladas')
      if (!fs.existsSync(cancelFolder)) {
        fs.mkdirSync(cancelFolder, { recursive: true })
      }
      
      // Mover XML se existir
      const oldXmlPath = path.join(nfseFolder, xmlName)
      if (fs.existsSync(oldXmlPath)) {
        fs.renameSync(oldXmlPath, path.join(cancelFolder, xmlName))
      }
      
      // Mover PDF se existir
      const oldPdfPath = path.join(nfseFolder, pdfName)
      if (fs.existsSync(oldPdfPath)) {
        fs.renameSync(oldPdfPath, path.join(cancelFolder, pdfName))
      }
    } catch (fsError) {
      console.warn('[Drive] Falha ao mover arquivos no drive local (provavelmente rodando na nuvem/Vercel):', fsError)
    }

    // Mover no Google Drive se configurado
    try {
      const key = emissao.chaveAcesso || String(emissao.numeroDps)
      await moverNotaNoGoogleDriveCancelada('NFSe', key)
    } catch (gdriveError) {
      console.error('[Google Drive] Falha ao processar cancelamento no Google Drive:', gdriveError)
    }
  } catch (error: any) {
    throw new Error(error.message || String(error))
  }
  
  revalidatePath(`/os/${serviceOrderId}/imprimir`)
}
