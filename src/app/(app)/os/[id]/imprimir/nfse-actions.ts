'use server'

import { prisma } from "@/lib/prisma"
import { getCompanySettings, getNfseConfig } from "@/lib/settings"
import { decryptSecret } from "@/lib/crypto"
import { extractCertMaterial } from "@/lib/nfse/certificate"
import { NfseClient } from "@/lib/nfse/client"
import { montarXmlDps, assinarDps } from "@/lib/nfse/dps"
import { enviarEmail } from "@/lib/email"
import { revalidatePath } from "next/cache"

export async function emitirNfseServiceOrder(serviceOrderId: string) {
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

  const client = new NfseClient({ ambiente, pfxBuffer, certPassword: certSenha })

  try {
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
  } catch (error) {
    await prisma.nfseEmissao.update({
      where: { id: emissao.id },
      data: {
        status: 'REJEITADA',
        motivoErro: error instanceof Error ? error.message : 'Erro desconhecido ao emitir a NFS-e.',
      }
    })
  }

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
  })

  revalidatePath(`/os/${serviceOrderId}/imprimir`)
}
