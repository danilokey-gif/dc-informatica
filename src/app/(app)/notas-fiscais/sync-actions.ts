'use server'

import { prisma } from "@/lib/prisma"
import { getNfeConfig, getNfseConfig, getCompanySettings } from "@/lib/settings"
import { decryptSecret } from "@/lib/crypto"
import { NfeSoapClient } from "@/lib/nfe/soap-client"
import { parseRetDistDFeInt } from "@/lib/nfe/distribuicao"
import { AdnClient } from "@/lib/nfse/adn-client"
import { gunzipSync } from "zlib"
import { revalidatePath } from "next/cache"

// Limites baixos de propósito: a função roda dentro do tempo limite de execução da Vercel.
// A NFS-e em especial consulta o governo um NSU por vez (não em lote), então qualquer limite
// alto vira dezenas/centenas de chamadas sequenciais e estoura o tempo antes de terminar.
// Prefira cliques mais curtos e repetidos (via "Continuar buscando mais") a um clique gigante.
const MAX_PAGINAS_NFE = 6 // até 50 documentos por página -> até 300 por clique
const MAX_TENTATIVAS_NFSE = 25 // NSU consultado um a um -> limite de chamadas por clique
const MAX_NAO_ENCONTRADOS_SEGUIDOS = 10 // pára de tentar depois de N NSUs vazios seguidos

export interface ResultadoSincronizacao {
  novos: number
  mensagem: string
  erro?: string
  /** Só presente quando a busca é por período: NSU onde a busca no governo parou, pra continuar no próximo clique. */
  proximoNsu?: string
  /** Só presente quando a busca é por período: true se ainda pode haver mais documentos no governo além do NSU alcançado. */
  temMais?: boolean
  /** Só presente quando a busca é por período: chaves de acesso de todas as notas do período (já existentes no
   * sistema + novas encontradas agora no governo), pra poder baixar um .zip com tudo. */
  chaves?: string[]
}

export interface OpcoesSincronizacao {
  /** Data (YYYY-MM-DD) — quando informada (com ou sem `fim`), entra no "modo período": primeiro busca no
   * próprio banco (instantâneo) e depois verifica novidades no governo a partir de `nsuInicial`. */
  inicio?: string
  fim?: string
  /** De onde continuar a verificação no governo (retornado como `proximoNsu` da chamada anterior). */
  nsuInicial?: string
}

// As duas funções abaixo NUNCA lançam (throw): o Next.js redige a mensagem de erros lançados
// por Server Actions em build de produção (só mostra um "digest" opaco), o que tornaria
// impossível diagnosticar problemas reais dessas integrações novas. Por isso capturam o erro
// internamente e devolvem no campo `erro` do objeto de retorno, que chega intacto ao cliente.

/** Formata um erro incluindo a cadeia de `cause` — o `fetch` do Node embrulha erros de rede/TLS
 * num TypeError genérico ("fetch failed") e só o `.cause` tem o motivo real (DNS, TLS, timeout). */
function formatarErro(error: unknown): string {
  if (!(error instanceof Error)) return String(error)
  const partes = [`${error.name}: ${error.message}`]
  let causa = (error as { cause?: unknown }).cause
  while (causa) {
    if (causa instanceof Error) {
      partes.push(`causa: ${causa.name}: ${causa.message}`)
      causa = (causa as { cause?: unknown }).cause
    } else {
      partes.push(`causa: ${String(causa)}`)
      break
    }
  }
  return partes.join(' | ')
}

/** Extrai a data/hora de emissão (<dhEmi>) do XML (NF-e e NFS-e usam a mesma tag). */
function extrairDataEmissao(xml: string): Date | null {
  const valor = xml.match(/<dhEmi>([^<]+)</)?.[1]
  if (!valor) return null
  const data = new Date(valor)
  return isNaN(data.getTime()) ? null : data
}

function dentroDoPeriodo(dataDoc: Date | null, inicio?: string, fim?: string): boolean {
  if (!dataDoc) return true // sem data extraída, não filtra (melhor importar do que perder)
  const dataStr = dataDoc.toISOString().slice(0, 10)
  if (inicio && dataStr < inicio) return false
  if (fim && dataStr > fim) return false
  return true
}

function limitesPeriodo(inicio?: string, fim?: string) {
  return {
    gte: inicio ? new Date(`${inicio}T00:00:00.000Z`) : undefined,
    lt: fim ? new Date(new Date(`${fim}T00:00:00.000Z`).getTime() + 24 * 60 * 60 * 1000) : undefined,
  }
}

export async function sincronizarNfeGoverno(opcoes?: OpcoesSincronizacao): Promise<ResultadoSincronizacao> {
  try {
    const [nfeConfig, empresa] = await Promise.all([getNfeConfig(), getCompanySettings()])

    if (!nfeConfig.certificado || !nfeConfig.certificadoSenha) {
      return { novos: 0, mensagem: '', erro: 'Certificado digital da NF-e não configurado. Vá em Configurações > Nota Fiscal de Produtos.' }
    }
    if (!empresa.document) {
      return { novos: 0, mensagem: '', erro: 'CNPJ da empresa não configurado.' }
    }

    const modoPeriodo = !!(opcoes?.inicio || opcoes?.fim)

    // Modo período: primeiro busca o que já está salvo no sistema (instantâneo, sem chamar o governo).
    const chavesDoPeriodo: string[] = []
    let jaExistentes = 0
    if (modoPeriodo) {
      const existentes = await prisma.nfeEmissao.findMany({
        where: { dataEmissao: limitesPeriodo(opcoes?.inicio, opcoes?.fim), chaveAcesso: { not: null } },
        select: { chaveAcesso: true },
      })
      for (const e of existentes) if (e.chaveAcesso) chavesDoPeriodo.push(e.chaveAcesso)
      jaExistentes = chavesDoPeriodo.length
    }

    const pfxBuffer = Buffer.from(nfeConfig.certificado, 'base64')
    const certSenha = decryptSecret(nfeConfig.certificadoSenha)
    const ambiente = nfeConfig.ambiente === 'producao' ? 'producao' : 'homologacao'
    const client = new NfeSoapClient({ ambiente, pfxBuffer, certPassword: certSenha })

    let ultNsu = modoPeriodo ? (opcoes?.nsuInicial || '000000000000000') : (nfeConfig.ultimoNsu || '000000000000000')
    let novos = 0
    let chegouAoFim = false

    for (let pagina = 0; pagina < MAX_PAGINAS_NFE; pagina++) {
      const respostaXml = await client.consultarDistribuicaoDFe(
        empresa.document.replace(/\D/g, ''),
        nfeConfig.uf,
        ambiente === 'producao' ? '1' : '2',
        ultNsu
      )
      const resultado = parseRetDistDFeInt(respostaXml)

      if (resultado.cStat === '137') { chegouAoFim = true; break } // nenhum documento localizado - não é erro
      if (resultado.cStat !== '138') {
        return { novos, mensagem: '', erro: `[${resultado.cStat}] ${resultado.xMotivo || 'Resposta inesperada da Sefaz'} — resposta bruta: ${respostaXml.slice(0, 500)}` }
      }

      for (const doc of resultado.documentos) {
        const dataEmissao = extrairDataEmissao(doc.xml)
        if (modoPeriodo && !dentroDoPeriodo(dataEmissao, opcoes?.inicio, opcoes?.fim)) continue

        const existente = await prisma.nfeEmissao.findUnique({ where: { chaveAcesso: doc.chaveAcesso } })
        if (existente) {
          if (modoPeriodo && !chavesDoPeriodo.includes(doc.chaveAcesso)) chavesDoPeriodo.push(doc.chaveAcesso)
          continue
        }
        if (modoPeriodo) chavesDoPeriodo.push(doc.chaveAcesso)

        await prisma.nfeEmissao.create({
          data: {
            ambiente,
            numero: parseInt(doc.chaveAcesso.slice(25, 34), 10) || 0,
            serie: doc.chaveAcesso.slice(22, 25) || '0',
            status: 'AUTORIZADA',
            chaveAcesso: doc.chaveAcesso,
            xmlNfe: doc.xml,
            origem: 'IMPORTADA_GOVERNO',
            destinatarioNome: doc.destinatarioNome,
            destinatarioDocumento: doc.destinatarioDocumento,
            valorTotal: doc.valorTotal,
            dataEmissao,
          }
        })
        novos++
      }

      ultNsu = resultado.ultNSU
      if (!modoPeriodo) {
        await prisma.nfeConfig.update({ where: { id: 'main' }, data: { ultimoNsu: ultNsu } })
      }

      if (resultado.ultNSU === resultado.maxNSU || resultado.documentos.length === 0) { chegouAoFim = true; break }
    }

    revalidatePath('/notas-fiscais')
    if (modoPeriodo) {
      return {
        novos,
        mensagem: `${jaExistentes} nota(s) de produto já estavam no sistema nesse período. ${novos} nova(s) encontrada(s) agora no governo (verificado até o NSU ${ultNsu}).${chegouAoFim ? '' : ' Ainda pode haver mais no governo além desse ponto — clique em "Continuar" para verificar.'}`,
        proximoNsu: ultNsu,
        temMais: !chegouAoFim,
        chaves: chavesDoPeriodo,
      }
    }
    return { novos, mensagem: `${novos} nota(s) de produto importada(s) do governo.` }
  } catch (error) {
    return { novos: 0, mensagem: '', erro: formatarErro(error) }
  }
}

export async function sincronizarNfseGoverno(opcoes?: OpcoesSincronizacao): Promise<ResultadoSincronizacao> {
  try {
    const nfseConfig = await getNfseConfig()

    if (!nfseConfig.certificado || !nfseConfig.certificadoSenha) {
      return { novos: 0, mensagem: '', erro: 'Certificado digital da NFS-e não configurado. Vá em Configurações > Nota Fiscal de Serviço.' }
    }

    const modoPeriodo = !!(opcoes?.inicio || opcoes?.fim)

    // Modo período: primeiro busca o que já está salvo no sistema (instantâneo, sem chamar o governo).
    const chavesDoPeriodo: string[] = []
    let jaExistentes = 0
    if (modoPeriodo) {
      const existentes = await prisma.nfseEmissao.findMany({
        where: { dataEmissao: limitesPeriodo(opcoes?.inicio, opcoes?.fim), chaveAcesso: { not: null } },
        select: { chaveAcesso: true },
      })
      for (const e of existentes) if (e.chaveAcesso) chavesDoPeriodo.push(e.chaveAcesso)
      jaExistentes = chavesDoPeriodo.length
    }

    const pfxBuffer = Buffer.from(nfseConfig.certificado, 'base64')
    const certSenha = decryptSecret(nfseConfig.certificadoSenha)
    const ambiente = nfseConfig.ambiente === 'producao' ? 'producao' : 'homologacao'
    const client = new AdnClient({ ambiente, pfxBuffer, certPassword: certSenha })

    const nsuBase = modoPeriodo ? (opcoes?.nsuInicial || '000000000000000') : (nfseConfig.ultimoNsu || '000000000000000')
    let nsuAtual = BigInt(nsuBase) + BigInt(1)
    let novos = 0
    let naoEncontradosSeguidos = 0
    let chegouAoFim = false

    for (let tentativa = 0; tentativa < MAX_TENTATIVAS_NFSE; tentativa++) {
      const nsuStr = nsuAtual.toString().padStart(15, '0')
      const resposta = await client.consultarDFePorNsu(nsuStr)

      if (!resposta) {
        naoEncontradosSeguidos++
        if (naoEncontradosSeguidos >= MAX_NAO_ENCONTRADOS_SEGUIDOS) { chegouAoFim = true; break }
        nsuAtual++
        continue
      }
      naoEncontradosSeguidos = 0

      for (const doc of resposta.LoteDFe) {
        if (doc.TipoDocumento !== 'NFSE') continue // ignora eventos/outros tipos por enquanto

        const xml = gunzipSync(Buffer.from(doc.ArquivoXml, 'base64')).toString('utf-8')
        const dataEmissao = extrairDataEmissao(xml)
        if (modoPeriodo && !dentroDoPeriodo(dataEmissao, opcoes?.inicio, opcoes?.fim)) continue

        const chaveAcesso = doc.ChaveAcesso
        const existente = await prisma.nfseEmissao.findUnique({ where: { chaveAcesso } })
        if (existente) {
          if (modoPeriodo && !chavesDoPeriodo.includes(chaveAcesso)) chavesDoPeriodo.push(chaveAcesso)
          continue
        }
        if (modoPeriodo) chavesDoPeriodo.push(chaveAcesso)

        const numeroDps = parseInt(xml.match(/<nDPS>(\d+)<\/nDPS>/)?.[1] || '0', 10)
        const serieDps = xml.match(/<serie>([^<]+)<\/serie>/)?.[1] || '0'
        const valorTotal = parseFloat(xml.match(/<vLiq>([^<]+)<\/vLiq>/)?.[1] || xml.match(/<vServ>([^<]+)<\/vServ>/)?.[1] || '0') || null
        const tomadorNome = xml.match(/<toma>[\s\S]*?<xNome>([^<]+)<\/xNome>/)?.[1] || null
        const tomadorDocumento = xml.match(/<toma>[\s\S]*?<(?:CNPJ|CPF)>(\d+)<\/(?:CNPJ|CPF)>/)?.[1] || null

        await prisma.nfseEmissao.create({
          data: {
            ambiente,
            numeroDps,
            serieDps,
            status: 'AUTORIZADA',
            chaveAcesso,
            xmlNfse: xml,
            origem: 'IMPORTADA_GOVERNO',
            tomadorNome,
            tomadorDocumento,
            valorTotal,
            dataEmissao,
          }
        })
        novos++
      }

      if (!modoPeriodo) {
        await prisma.nfseConfig.update({ where: { id: 'main' }, data: { ultimoNsu: nsuStr } })
      }
      nsuAtual++
    }

    const nsuFinal = (nsuAtual - BigInt(1)).toString().padStart(15, '0')
    revalidatePath('/notas-fiscais')
    if (modoPeriodo) {
      return {
        novos,
        mensagem: `${jaExistentes} nota(s) de serviço já estavam no sistema nesse período. ${novos} nova(s) encontrada(s) agora no governo (verificado até o NSU ${nsuFinal}).${chegouAoFim ? '' : ' Ainda pode haver mais no governo além desse ponto — clique em "Continuar" para verificar.'}`,
        proximoNsu: nsuFinal,
        temMais: !chegouAoFim,
        chaves: chavesDoPeriodo,
      }
    }
    return { novos, mensagem: `${novos} nota(s) de serviço importada(s) do governo.` }
  } catch (error) {
    return { novos: 0, mensagem: '', erro: formatarErro(error) }
  }
}
