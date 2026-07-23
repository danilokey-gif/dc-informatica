'use server'

import { prisma } from "@/lib/prisma"
import { getCompanySettings, getNfseConfig } from "@/lib/settings"
import { decryptSecret } from "@/lib/crypto"
import { extractCertMaterial } from "@/lib/nfse/certificate"
import { NfseClient } from "@/lib/nfse/client"
import { montarXmlDps, assinarDps } from "@/lib/nfse/dps"
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
