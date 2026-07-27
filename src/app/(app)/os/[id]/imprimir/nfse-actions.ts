'use server'

import { prisma } from "@/lib/prisma"
import { getCompanySettings, getNfseConfig } from "@/lib/settings"
import { decryptSecret } from "@/lib/crypto"
import { extractCertMaterial } from "@/lib/nfse/certificate"
import { NfseClient } from "@/lib/nfse/client"
import { montarXmlDps, assinarDps } from "@/lib/nfse/dps"
import { enviarEmail } from "@/lib/email"
import { revalidatePath } from "next/cache"
import { gerarPdfDanfse } from "@/lib/pdf-notas"

export async function emitirNfseServiceOrder(serviceOrderId: string) {
  let emissaoId: string | null = null
  try {
    const [os, empresa, nfseConfig] = await Promise.all([
      prisma.serviceOrder.findUniqueOrThrow({ where: { id: serviceOrderId }, include: { customer: true } }),
      getCompanySettings(),
      getNfseConfig(),
    ])

    if (!nfseConfig.certificado || !nfseConfig.certificadoSenha) {
      throw new Error('Certificado digital não configurado. Vá em Configurações > Nota Fiscal de Serviço.')
    }
    if (!nfseConfig.codigoMunicipio || !nfseConfig.codigoServico || nfseConfig.aliquotaIss === null) {
      throw new Error('Configuração fiscal incompleta (município, código de serviço ou alíquota de ISS). Vá em Configurações.')
    }
    if (!empresa.document) {
      throw new Error('CNPJ/CPF da empresa não configurado. Vá em Configurações > Dados da Empresa.')
    }
    if (!os.price) {
      throw new Error('Informe o valor da OS antes de emitir a nota fiscal.')
    }

    const pfxBuffer = Buffer.from(nfseConfig.certificado, 'base64')
    const certSenha = decryptSecret(nfseConfig.certificadoSenha)
    const certMaterial = extractCertMaterial(pfxBuffer, certSenha)

    const numeroDps = nfseConfig.proximoNumeroDps
    const ambiente = nfseConfig.ambiente === 'producao' ? 'producao' : 'homologacao'

    const { xml, id } = montarXmlDps({
      ambiente,
      codigoMunicipio: nfseConfig.codigoMunicipio,
      serie: nfseConfig.serieDps,
      numero: numeroDps,
      dataCompetencia: new Date(),
      prestador: {
        documento: empresa.document,
        razaoSocial: empresa.name,
      },
      tomador: {
        documento: os.customer.document || undefined,
        nome: os.customer.name,
      },
      servico: {
        codigoTributacaoNacional: nfseConfig.codigoServico,
        descricao: `${os.device} - ${os.issue}`.slice(0, 2000),
        valor: os.price,
      },
      aliquotaIss: nfseConfig.aliquotaIss,
      regimeTributario: nfseConfig.regimeTributario as 'MEI' | 'SIMPLES' | 'NORMAL',
    })

    const xmlAssinado = assinarDps(xml, id, certMaterial)

    const emissao = await prisma.nfseEmissao.create({
      data: {
        serviceOrderId,
        ambiente,
        numeroDps,
        serieDps: nfseConfig.serieDps,
        status: 'PROCESSANDO',
        xmlDps: xmlAssinado,
      }
    })
    emissaoId = emissao.id

    const client = new NfseClient({ ambiente, pfxBuffer, certPassword: certSenha })
    const resposta = await client.emitirNfse(xmlAssinado)

    await prisma.$transaction([
      prisma.nfseEmissao.update({
        where: { id: emissao.id },
        data: {
          status: 'AUTORIZADA',
          chaveAcesso: resposta.chaveAcesso,
          xmlNfse: resposta.xmlNfse || null,
        }
      }),
      prisma.nfseConfig.update({
        where: { id: 'main' },
        data: { proximoNumeroDps: { increment: 1 } }
      })
    ])
  } catch (error: any) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    if (emissaoId) {
      await prisma.nfseEmissao.update({
        where: { id: emissaoId },
        data: { status: 'REJEITADA', motivoErro: errorMsg }
      })
    } else {
      await prisma.nfseEmissao.create({
        data: {
          serviceOrderId,
          ambiente: 'homologacao',
          numeroDps: 0,
          serieDps: '0',
          status: 'REJEITADA',
          motivoErro: errorMsg,
        }
      })
    }
  }

  revalidatePath(`/os/${serviceOrderId}/imprimir`)
}

export async function enviarNfseEmail(serviceOrderId: string) {
  const [os, empresa, emissao, nfseConfig] = await Promise.all([
    prisma.serviceOrder.findUniqueOrThrow({ where: { id: serviceOrderId }, include: { customer: true } }),
    getCompanySettings(),
    prisma.nfseEmissao.findFirst({ where: { serviceOrderId, status: 'AUTORIZADA' }, orderBy: { createdAt: 'desc' } }),
    getNfseConfig(),
  ])

  if (!os.customer.email) {
    throw new Error('Cliente não tem e-mail cadastrado. Edite o cliente para adicionar um.')
  }
  if (!emissao) {
    throw new Error('Nenhuma NFS-e autorizada encontrada para esta OS.')
  }

  const valor = os.price ? os.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : ''
  
  // Gerar anexo em PDF do DANFSe oficial
  const numeroNfse = emissao.xmlNfse?.match(/<nNFSe>(\d+)<\/nNFSe>/)?.[1] || emissao.numeroDps
  const municipioLabel = nfseConfig.nomeMunicipio ? `${nfseConfig.nomeMunicipio} - SP` : '-'
  const enderecoPrestador = `${empresa.enderLogradouro || ''}${empresa.enderNumero ? `, ${empresa.enderNumero}` : ''}${empresa.enderBairro ? `, ${empresa.enderBairro}` : ''}`
  
  const pdfBuffer = await gerarPdfDanfse({
    ambiente: emissao.ambiente,
    numeroNfse,
    numeroDps: emissao.numeroDps,
    serieDps: emissao.serieDps,
    chaveAcesso: emissao.chaveAcesso || '',
    dataEmissao: emissao.createdAt,
    prestadorNome: empresa.name,
    prestadorCnpj: empresa.document || '',
    prestadorTelefone: empresa.phone,
    prestadorEmail: empresa.email,
    prestadorEndereco: enderecoPrestador,
    prestadorCep: empresa.enderCep,
    tomadorNome: os.customer.name,
    tomadorDocumento: os.customer.document,
    tomadorTelefone: os.customer.phone,
    tomadorEmail: os.customer.email,
    tomadorEndereco: os.customer.address,
    descricaoServico: `${os.device} — ${os.issue}`,
    codigoServico: nfseConfig.codigoServico,
    descricaoCodServico: nfseConfig.descricaoCodServico,
    municipioLabel,
    regimeTributario: nfseConfig.regimeTributario,
    aliquotaIss: nfseConfig.aliquotaIss,
    valorTotal: valor,
  })

  await enviarEmail({
    to: os.customer.email,
    subject: `Nota Fiscal de Serviço - ${empresa.name}`,
    html: `
      <p>Olá, ${os.customer.name}!</p>
      <p>Segue a Nota Fiscal de Serviço referente ao atendimento do seu ${os.device}.</p>
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
