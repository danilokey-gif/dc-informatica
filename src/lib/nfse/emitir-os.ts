import { prisma } from "@/lib/prisma"
import { getCompanySettings, getNfseConfig } from "@/lib/settings"
import { decryptSecret } from "@/lib/crypto"
import { extractCertMaterial } from "@/lib/nfse/certificate"
import { NfseClient } from "@/lib/nfse/client"
import { montarXmlDps, assinarDps } from "@/lib/nfse/dps"
import { gerarDanfsePdf } from "@/lib/nfse/danfse"
import { salvarNotaNoDrive } from "@/lib/drive"

/** Código de serviço próprio, no lugar do que está na configuração geral da NFS-e. A descrição
 * do código não vai na DPS: a Sefin devolve o xTribNac na NFS-e e o DANFSe lê de lá. */
export interface ServicoNfse {
  codigoServico: string
}

export type ResultadoEmissaoNfse =
  | { ok: true; emissaoId: string; chaveAcesso: string | null; numeroNfse: string; pdf: Buffer | null }
  | { ok: false; erro: string; emissaoId: string | null }

/**
 * Emite a NFS-e de uma OS. É o mesmo fluxo que a tela da OS sempre usou (movido para cá para a
 * cobrança mensal também poder chamar), com dois acréscimos: aceita um código de serviço próprio
 * e devolve o resultado em vez de só gravar o status.
 */
export async function emitirNfseDaOs(serviceOrderId: string, servico?: ServicoNfse): Promise<ResultadoEmissaoNfse> {
  let emissaoId: string | null = null
  try {
    const [os, empresa, nfseConfig] = await Promise.all([
      prisma.serviceOrder.findUniqueOrThrow({ where: { id: serviceOrderId }, include: { customer: true } }),
      getCompanySettings(),
      getNfseConfig(),
    ])

    const codigoServico = servico?.codigoServico || nfseConfig.codigoServico

    if (!nfseConfig.certificado || !nfseConfig.certificadoSenha) {
      throw new Error('Certificado digital não configurado. Vá em Configurações > Nota Fiscal de Serviço.')
    }
    if (!nfseConfig.codigoMunicipio || !codigoServico || nfseConfig.aliquotaIss === null) {
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
    const descricaoServico = [os.device, os.issue].filter(Boolean).join(' - ').slice(0, 2000)

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
        codigoTributacaoNacional: codigoServico,
        descricao: descricaoServico,
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

    const dataEmissao = resposta.xmlNfse?.match(/<dhProc>([^<]+)<\/dhProc>/)?.[1]
      ? new Date(resposta.xmlNfse.match(/<dhProc>([^<]+)<\/dhProc>/)![1])
      : new Date()

    await prisma.$transaction([
      prisma.nfseEmissao.update({
        where: { id: emissao.id },
        data: {
          status: 'AUTORIZADA',
          chaveAcesso: resposta.chaveAcesso,
          xmlNfse: resposta.xmlNfse || null,
          // Grava a data real de emissao aqui tambem (nao so nas notas importadas do governo),
          // pra que os relatorios e filtros por periodo leiam sempre o mesmo campo.
          dataEmissao,
        }
      }),
      prisma.nfseConfig.update({
        where: { id: 'main' },
        data: { proximoNumeroDps: { increment: 1 } }
      })
    ])

    const numeroNfse = resposta.xmlNfse?.match(/<nNFSe>(\d+)<\/nNFSe>/)?.[1] || String(numeroDps)

    // A nota já está autorizada daqui pra baixo: falha no PDF ou no Drive não muda o resultado.
    let pdf: Buffer | null = null
    try {
      // DANFSe v2.0 (NT 008/2026): sai do XML devolvido pela Sefin, não dos dados da OS.
      if (resposta.xmlNfse) pdf = await gerarDanfsePdf(resposta.xmlNfse)
      const key = resposta.chaveAcesso || String(numeroDps)
      if (pdf) await salvarNotaNoDrive('NFSe', key, resposta.xmlNfse || null, pdf)
    } catch (err) {
      console.error('[Drive] Erro ao gerar/salvar PDF da NFSe:', err)
    }

    return { ok: true, emissaoId: emissao.id, chaveAcesso: resposta.chaveAcesso || null, numeroNfse, pdf }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    if (emissaoId) {
      await prisma.nfseEmissao.update({
        where: { id: emissaoId },
        data: { status: 'REJEITADA', motivoErro: errorMsg }
      })
    } else {
      const registro = await prisma.nfseEmissao.create({
        data: {
          serviceOrderId,
          ambiente: 'homologacao',
          numeroDps: 0,
          serieDps: '0',
          status: 'REJEITADA',
          motivoErro: errorMsg,
        }
      })
      emissaoId = registro.id
    }
    return { ok: false, erro: errorMsg, emissaoId }
  }
}
