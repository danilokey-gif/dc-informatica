'use server'

import { prisma } from "@/lib/prisma"
import { getNfseConfig } from "@/lib/settings"
import { decryptSecret } from "@/lib/crypto"
import { formatarErro } from "@/lib/formatar-erro"
import { AdnClient } from "@/lib/nfse/adn-client"
import { gunzipSync } from "zlib"
import { revalidatePath } from "next/cache"

// Limites baixos de propósito: a função roda dentro do tempo limite de execução da Vercel.
// A NFS-e em especial consulta o governo um NSU por vez (não em lote), então qualquer limite
// alto vira dezenas/centenas de chamadas sequenciais e estoura o tempo antes de terminar.
// Prefira cliques mais curtos e repetidos (via "Continuar buscando mais") a um clique gigante.
//
// Os limites por CONTAGEM abaixo são um teto de segurança; quem realmente decide quando parar
// de chamar o governo é o relógio (TEMPO_LIMITE_MS) — o governo pode responder rápido ou devagar
// dependendo do dia, e um limite fixo de tentativas não se adapta a isso.
const TEMPO_LIMITE_MS = 7_000 // deixa ~3s de folga pra descriptografia do cert, parsing e resposta
const MAX_TENTATIVAS_NFSE = 25 // NSU consultado um a um -> limite de chamadas por clique
const MAX_NAO_ENCONTRADOS_SEGUIDOS = 10 // só usado no modo simples (sem período)

export interface ResultadoSincronizacao {
  novos: number
  mensagem: string
  erro?: string
  /** Só presente quando a busca é por período: NSU onde a busca no governo parou, pra continuar no próximo clique. */
  proximoNsu?: string
  /** true se a busca parou por limite de tempo/tentativas (não porque acabaram os documentos) —
   * usado pelo botão pra saber se deve chamar a action de novo automaticamente. */
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
    // Contador de tentativas usadas de verdade (para ajustar a mensagem)
    let tentativasUsadas = 0

    const inicioExecucao = Date.now()

    for (let tentativa = 0; tentativa < MAX_TENTATIVAS_NFSE && Date.now() - inicioExecucao < TEMPO_LIMITE_MS; tentativa++) {
      tentativasUsadas++
      const nsuStr = nsuAtual.toString().padStart(15, '0')
      const resposta = await client.consultarDFePorNsu(nsuStr)

      if (!resposta) {
        naoEncontradosSeguidos++
        // No modo período: NUNCA para por NSUs vazios — o usuário precisa continuar clicando
        // até encontrar suas notas (que podem estar em NSUs muito mais altos).
        // No modo simples: para após N seguidos vazios, pois é só para "atualizar novidades".
        if (!modoPeriodo && naoEncontradosSeguidos >= MAX_NAO_ENCONTRADOS_SEGUIDOS) {
          chegouAoFim = true
          break
        }
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

        const nfseNovaEmissao = await prisma.nfseEmissao.create({
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

        // Alimenta o financeiro automaticamente ao importar nota do governo
        if (valorTotal && valorTotal > 0) {
          const dataRef = dataEmissao || new Date()
          const descricao = tomadorNome
            ? `NFS-e DPS ${nfseNovaEmissao.numeroDps} — ${tomadorNome}`
            : `NFS-e DPS ${nfseNovaEmissao.numeroDps} (importada do governo)`
          await prisma.financeTransaction.create({
            data: {
              type: 'RECEITA',
              description: descricao,
              amount: valorTotal,
              dueDate: dataRef,
              paidDate: dataRef,
              status: 'PAGO',
              paymentMethod: 'NFS-e',
              notes: `Chave de acesso: ${chaveAcesso}`,
            }
          })
        }
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
      // Em modo período: sempre mostra "Continuar" se esgotamos as tentativas sem chegar ao fim natural.
      // O usuário pode ter notas em NSUs muito maiores que o ponto até onde verificamos.
      const podeHaverMais = !chegouAoFim // no modo período, chegouAoFim nunca é true, então sempre true
      const nsuVerificado = BigInt(nsuBase)
      const nsuAtualNum = nsuAtual
      const qtdVerificados = Number(nsuAtualNum - nsuVerificado - BigInt(1))
      return {
        novos,
        mensagem: `🔍 Verificados ${qtdVerificados} NSU(s) a partir do NSU ${nsuBase}. ${jaExistentes > 0 ? `${jaExistentes} nota(s) já estavam no sistema. ` : ''}${novos} nota(s) nova(s) encontrada(s). Verificado até o NSU ${nsuFinal}.${podeHaverMais ? ' Clique em "Continuar buscando mais" para verificar os próximos NSUs.' : ''}`,
        proximoNsu: nsuFinal,
        temMais: podeHaverMais,
        chaves: chavesDoPeriodo,
      }
    }
    return { novos, mensagem: `${novos} nota(s) de serviço importada(s) do governo.`, temMais: !chegouAoFim }
  } catch (error) {
    return { novos: 0, mensagem: '', erro: formatarErro(error) }
  }
}
