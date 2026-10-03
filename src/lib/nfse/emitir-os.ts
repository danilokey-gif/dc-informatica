import { prisma } from "@/lib/prisma"
import { getCompanySettings, getNfseConfig } from "@/lib/settings"
import { decryptSecret } from "@/lib/crypto"
import { extractCertMaterial } from "@/lib/nfse/certificate"
import { NfseClient } from "@/lib/nfse/client"
import { montarXmlDps, assinarDps, type DpsTomador } from "@/lib/nfse/dps"
import tabelasIbge from "@/lib/nfse/tabelas-ibge.json"
import { gerarDanfsePdf } from "@/lib/nfse/danfse"
import { salvarNotaNoDrive } from "@/lib/drive"

/** Código de serviço próprio, no lugar do que está na configuração geral da NFS-e. A descrição
 * do código não vai na DPS: a Sefin devolve o xTribNac na NFS-e e o DANFSe lê de lá. */
export interface ServicoNfse {
  codigoServico: string
}

export type ResultadoEmissaoNfse =
  /** aviso: a nota saiu, mas sem algum dado do cliente que a Sefin recusou (ex.: CEP de outro município). */
  | { ok: true; emissaoId: string; chaveAcesso: string | null; numeroNfse: string; pdf: Buffer | null; aviso: string | null }
  | { ok: false; erro: string; emissaoId: string | null }

/**
 * Emite a NFS-e de uma OS. É o mesmo fluxo que a tela da OS sempre usou (movido para cá para a
 * cobrança mensal também poder chamar), com dois acréscimos: aceita um código de serviço próprio
 * e devolve o resultado em vez de só gravar o status.
 */
interface ClienteNfse {
  name: string
  document: string | null
  phone: string | null
  email: string | null
  enderLogradouro: string | null
  enderNumero: string | null
  enderBairro: string | null
  enderCep: string | null
  enderCodMunicipio: string | null
}

const MUNICIPIOS_IBGE = tabelasIbge.municipios as Record<string, string>

/**
 * Dados do tomador para a DPS. O endereço só vai quando está completo e com código de município
 * que existe na tabela do IBGE (regra E0238); telefone e e-mail, quando têm formato válido.
 * O leiaute exige endereço para tomador com CNPJ (regra E0235), e é ele que aparece no DANFSe.
 */
export function montarTomador(c: ClienteNfse, opcoes: { semEndereco: boolean; semEmail: boolean }): DpsTomador {
  const soDigitos = (v: string | null) => (v || '').replace(/\D/g, '')
  const cMun = soDigitos(c.enderCodMunicipio)
  const cep = soDigitos(c.enderCep)
  const enderecoCompleto = cMun.length === 7 && !!MUNICIPIOS_IBGE[cMun] && cep.length === 8 &&
    !!c.enderLogradouro?.trim() && !!c.enderNumero?.trim() && !!c.enderBairro?.trim()
  const fone = soDigitos(c.phone)
  const email = (c.email || '').trim()
  return {
    documento: c.document || undefined,
    nome: c.name,
    endereco: enderecoCompleto && !opcoes.semEndereco
      ? { codigoMunicipio: cMun, cep, logradouro: c.enderLogradouro!.trim(), numero: c.enderNumero!.trim(), bairro: c.enderBairro!.trim() }
      : undefined,
    telefone: fone.length >= 10 && fone.length <= 20 ? fone : undefined,
    email: !opcoes.semEmail && email.length <= 80 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined,
  }
}

// Recusas da Sefin causadas por dado do cadastro do cliente que dá para simplesmente não mandar:
// E0238 = município do endereço não existe; E0240 = CEP não pertence ao município; E0247 = e-mail inválido.
const ERROS_ENDERECO = /\[E0238\]|\[E0240\]/
const ERROS_EMAIL = /\[E0247\]/

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

    const montarDps = (opcoes: { semEndereco: boolean; semEmail: boolean }) => {
      const { xml, id } = montarXmlDps({
        ambiente,
        codigoMunicipio: nfseConfig.codigoMunicipio!,
        serie: nfseConfig.serieDps,
        numero: numeroDps,
        dataCompetencia: new Date(),
        prestador: {
          documento: empresa.document!,
          razaoSocial: empresa.name,
        },
        tomador: montarTomador(os.customer, opcoes),
        servico: {
          codigoTributacaoNacional: codigoServico!,
          descricao: descricaoServico,
          valor: os.price!,
        },
        aliquotaIss: nfseConfig.aliquotaIss!,
        regimeTributario: nfseConfig.regimeTributario as 'MEI' | 'SIMPLES' | 'NORMAL',
      })
      return assinarDps(xml, id, certMaterial)
    }

    const opcoesTomador = { semEndereco: false, semEmail: false }
    let xmlAssinado = montarDps(opcoesTomador)

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
    // Se a Sefin recusar só por causa do endereço ou do e-mail do cliente, emite de novo sem esse
    // dado (no máximo duas vezes) em vez de deixar a nota sem sair. A recusa acontece antes de
    // qualquer nota existir, então reenviar a mesma DPS não gera nota em dobro.
    let aviso: string | null = null
    let resposta: Awaited<ReturnType<NfseClient['emitirNfse']>>
    for (let tentativa = 0; ; tentativa++) {
      try {
        resposta = await client.emitirNfse(xmlAssinado)
        break
      } catch (erro) {
        const msg = erro instanceof Error ? erro.message : String(erro)
        const podeTirarEndereco = !opcoesTomador.semEndereco && ERROS_ENDERECO.test(msg)
        const podeTirarEmail = !opcoesTomador.semEmail && ERROS_EMAIL.test(msg)
        if (tentativa >= 2 || (!podeTirarEndereco && !podeTirarEmail)) throw erro
        if (podeTirarEndereco) opcoesTomador.semEndereco = true
        if (podeTirarEmail) opcoesTomador.semEmail = true
        aviso = `Nota emitida sem ${[podeTirarEndereco && 'o endereço', podeTirarEmail && 'o e-mail'].filter(Boolean).join(' e ')} ` +
          `do cliente, que a Sefin recusou: ${msg}. Corrija o cadastro de ${os.customer.name}.`
        xmlAssinado = montarDps(opcoesTomador)
        await prisma.nfseEmissao.update({ where: { id: emissao.id }, data: { xmlDps: xmlAssinado } })
      }
    }

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
          // A nota é válida; o aviso fica visível na lista de notas para o cadastro ser corrigido.
          motivoErro: aviso,
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

    return { ok: true, emissaoId: emissao.id, chaveAcesso: resposta.chaveAcesso || null, numeroNfse, pdf, aviso }
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
