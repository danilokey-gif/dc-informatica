'use server'

import { prisma } from "@/lib/prisma"
import { getNfeConfig, getCompanySettings } from "@/lib/settings"
import { decryptSecret } from "@/lib/crypto"
import { NfeSoapClient } from "@/lib/nfe/soap-client"
import { extractCertMaterial } from "@/lib/nfse/certificate"
import { montarEventoCiencia, assinarEventoNfe, TP_EVENTO_CIENCIA } from "@/lib/nfe/xml"
import { parseRetDistDFeInt, TP_EVENTO_CANCELAMENTO } from "@/lib/nfe/distribuicao"
import { formatarErro } from "@/lib/formatar-erro"
import { revalidatePath } from "next/cache"

// A função roda dentro do tempo limite da Vercel; o relógio decide quando parar, o limite de
// páginas é só um teto de segurança (cada página traz até 50 documentos).
const TEMPO_LIMITE_MS = 7_000
const MAX_PAGINAS = 6

// Regras da Sefaz para a Distribuição DF-e (NT 2014.002):
// - depois de "nenhum documento localizado" (cStat 137), só pode consultar de novo após 1 hora;
// - consultar antes disso gera cStat 656 e bloqueia o CNPJ por 1 hora;
// - cada consulta DURANTE o bloqueio zera o relógio de novo.
// Por isso guardamos quando a próxima consulta está liberada e nem chamamos a Sefaz antes disso.
// Os 5 minutos a mais são margem pra diferença de relógio entre o nosso servidor e o da Sefaz.
const ESPERA_OBRIGATORIA_MS = 65 * 60 * 1000

export interface ResultadoBuscaFornecedores {
  novas: number
  atualizadas: number
  mensagem: string
  erro?: string
  /** true se parou pelo limite de tempo e ainda há documentos na Sefaz — o botão chama de novo. */
  temMais?: boolean
}

function horario(d: Date): string {
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
}

function maiorNsu(a: string, b: string): string {
  return BigInt(a || '0') >= BigInt(b || '0') ? a : b
}

export async function buscarNotasFornecedores(): Promise<ResultadoBuscaFornecedores> {
  try {
    const [nfeConfig, empresa] = await Promise.all([getNfeConfig(), getCompanySettings()])

    if (!nfeConfig.certificado || !nfeConfig.certificadoSenha) {
      return { novas: 0, atualizadas: 0, mensagem: '', erro: 'Certificado digital da NF-e não configurado. Vá em Configurações > Nota Fiscal de Produtos.' }
    }
    const cnpjEmpresa = (empresa.document || '').replace(/\D/g, '')
    if (!cnpjEmpresa) {
      return { novas: 0, atualizadas: 0, mensagem: '', erro: 'CNPJ da empresa não configurado.' }
    }

    const agora = new Date()
    if (nfeConfig.distDfeLiberadoEm && nfeConfig.distDfeLiberadoEm > agora) {
      return {
        novas: 0, atualizadas: 0, mensagem: '',
        erro: `A Sefaz só libera a próxima consulta às ${horario(nfeConfig.distDfeLiberadoEm)}. ` +
          'O sistema não vai consultar antes disso, porque consultar cedo faz a Sefaz bloquear o CNPJ por mais 1 hora.',
      }
    }

    const ambiente = nfeConfig.ambiente === 'producao' ? 'producao' : 'homologacao'
    const client = new NfeSoapClient({
      ambiente,
      pfxBuffer: Buffer.from(nfeConfig.certificado, 'base64'),
      certPassword: decryptSecret(nfeConfig.certificadoSenha),
    })

    // A Sefaz exige que as consultas sigam o NSU em ordem crescente: sempre continuamos do último
    // NSU recebido, nunca do zero.
    let ultNsu = nfeConfig.ultimoNsu || '000000000000000'
    let novas = 0
    let atualizadas = 0
    let chegouAoFim = false
    const inicio = Date.now()

    for (let pagina = 0; pagina < MAX_PAGINAS && Date.now() - inicio < TEMPO_LIMITE_MS; pagina++) {
      const resposta = parseRetDistDFeInt(await client.consultarDistribuicaoDFe(
        cnpjEmpresa, nfeConfig.uf, ambiente === 'producao' ? '1' : '2', ultNsu,
      ))

      if (resposta.cStat === '656' || resposta.cStat === '137') {
        const liberadoEm = new Date(Date.now() + ESPERA_OBRIGATORIA_MS)
        await prisma.nfeConfig.update({
          where: { id: 'main' },
          data: { distDfeLiberadoEm: liberadoEm, ultimoNsu: maiorNsu(ultNsu, resposta.ultNSU) },
        })
        if (resposta.cStat === '656') {
          return {
            novas, atualizadas, mensagem: '',
            erro: `A Sefaz bloqueou as consultas deste CNPJ por 1 hora (código 656: ${resposta.xMotivo}). ` +
              `O sistema vai esperar e só libera o botão de novo às ${horario(liberadoEm)}.`,
          }
        }
        chegouAoFim = true
        break
      }
      if (resposta.cStat !== '138') {
        return { novas, atualizadas, mensagem: '', erro: `A Sefaz respondeu [${resposta.cStat}] ${resposta.xMotivo || 'sem motivo informado'}.` }
      }

      for (const doc of resposta.documentos) {
        if (doc.tipo === 'evento') {
          if (doc.tpEvento === TP_EVENTO_CANCELAMENTO) {
            const r = await prisma.nfeRecebida.updateMany({
              where: { chaveAcesso: doc.chaveAcesso, situacao: { not: '3' } },
              data: { situacao: '3' },
            })
            atualizadas += r.count
          }
          continue
        }

        // Notas emitidas pela própria empresa não são "de fornecedor". A Sefaz não costuma mandá-las
        // por esse serviço, mas se mandar, não entram aqui.
        if (doc.emitenteCnpj === cnpjEmpresa) continue

        const existente = await prisma.nfeRecebida.findUnique({ where: { chaveAcesso: doc.chaveAcesso } })
        const dados = {
          nsu: doc.nsu,
          emitenteCnpj: doc.emitenteCnpj,
          emitenteNome: doc.emitenteNome,
          emitenteIe: doc.emitenteIe,
          numero: doc.numero,
          serie: doc.serie,
          valorTotal: doc.valorTotal,
          dataEmissao: doc.dataEmissao,
          situacao: doc.situacao,
          completa: doc.completa,
          xml: doc.xml,
        }
        if (!existente) {
          await prisma.nfeRecebida.create({ data: { chaveAcesso: doc.chaveAcesso, ...dados } })
          novas++
        } else if (doc.completa && !existente.completa) {
          // Chegou o XML completo de uma nota que antes só tinha o resumo.
          await prisma.nfeRecebida.update({ where: { id: existente.id }, data: dados })
          atualizadas++
        }
      }

      ultNsu = maiorNsu(ultNsu, resposta.ultNSU)
      const alcancouOFim = BigInt(resposta.ultNSU) >= BigInt(resposta.maxNSU)
      await prisma.nfeConfig.update({
        where: { id: 'main' },
        // Chegando ao último NSU, a próxima consulta receberia 137 — já marcamos a espera aqui.
        data: { ultimoNsu: ultNsu, ...(alcancouOFim ? { distDfeLiberadoEm: new Date(Date.now() + ESPERA_OBRIGATORIA_MS) } : {}) },
      })
      if (alcancouOFim) { chegouAoFim = true; break }
    }

    revalidatePath('/notas-fiscais/fornecedores')
    const partes = [`${novas} nota(s) nova(s) de fornecedores`]
    if (atualizadas) partes.push(`${atualizadas} atualizada(s)`)
    return {
      novas,
      atualizadas,
      mensagem: `${partes.join(', ')}.${chegouAoFim ? ' Tudo em dia com a Sefaz — a próxima consulta fica liberada em 1 hora.' : ''}`,
      temMais: !chegouAoFim,
    }
  } catch (error) {
    return { novas: 0, atualizadas: 0, mensagem: '', erro: formatarErro(error) }
  }
}

// O schema da Sefaz aceita no máximo 20 eventos por lote.
const MAX_CIENCIAS_POR_ENVIO = 20

export interface ResultadoCiencia {
  registradas: number
  falhas: { nota: string; motivo: string }[]
  erro?: string
}

function tagEm(xml: string, nome: string): string | null {
  return xml.match(new RegExp(`<${nome}>([^<]*)</${nome}>`))?.[1] ?? null
}

/**
 * Registra a Ciência da Operação (evento 210210) nas notas indicadas. É o aviso oficial de que a
 * empresa sabe da nota: não confirma nem recusa a compra. Depois dele, a Sefaz passa a entregar o
 * XML completo na próxima busca de notas de compra.
 */
export async function darCiencia(ids: string[]): Promise<ResultadoCiencia> {
  try {
    if (ids.length === 0) return { registradas: 0, falhas: [] }
    if (ids.length > MAX_CIENCIAS_POR_ENVIO) {
      return { registradas: 0, falhas: [], erro: `Envie no máximo ${MAX_CIENCIAS_POR_ENVIO} notas por vez.` }
    }

    const [nfeConfig, empresa] = await Promise.all([getNfeConfig(), getCompanySettings()])
    if (!nfeConfig.certificado || !nfeConfig.certificadoSenha) {
      return { registradas: 0, falhas: [], erro: 'Certificado digital da NF-e não configurado.' }
    }
    const cnpjEmpresa = (empresa.document || '').replace(/\D/g, '')
    if (!cnpjEmpresa) return { registradas: 0, falhas: [], erro: 'CNPJ da empresa não configurado.' }

    // Só faz sentido para resumos ainda sem manifestação e que não foram cancelados pelo fornecedor.
    const notas = await prisma.nfeRecebida.findMany({
      where: { id: { in: ids }, completa: false, manifestacao: null, situacao: '1' },
    })
    if (notas.length === 0) return { registradas: 0, falhas: [], erro: 'Nenhuma das notas selecionadas precisa de ciência.' }

    const pfxBuffer = Buffer.from(nfeConfig.certificado, 'base64')
    const certSenha = decryptSecret(nfeConfig.certificadoSenha)
    const certMaterial = extractCertMaterial(pfxBuffer, certSenha)
    const ambiente = nfeConfig.ambiente === 'producao' ? 'producao' : 'homologacao'
    const tpAmb = ambiente === 'producao' ? '1' : '2'

    const eventos = notas.map(n => {
      const { xml, id } = montarEventoCiencia({ cnpjDestinatario: cnpjEmpresa, chaveAcesso: n.chaveAcesso, tpAmb })
      return assinarEventoNfe(xml, id, certMaterial)
    })

    const client = new NfeSoapClient({ ambiente, pfxBuffer, certPassword: certSenha })
    const idLote = String(Date.now()).slice(-15)
    const resposta = await client.enviarEventosAN(idLote, eventos)

    // 128 = lote processado; o resultado de cada nota vem num <retEvento> próprio.
    const cStatLote = tagEm(resposta, 'cStat')
    const retornos = resposta.match(/<retEvento[\s\S]*?<\/retEvento>/g) || []
    if (retornos.length === 0) {
      return { registradas: 0, falhas: [], erro: `A Sefaz recusou o lote [${cStatLote}] ${tagEm(resposta, 'xMotivo') || 'sem motivo informado'}.` }
    }

    let registradas = 0
    const falhas: ResultadoCiencia['falhas'] = []
    const agora = new Date()
    for (const ret of retornos) {
      const chave = tagEm(ret, 'chNFe')
      const cStat = tagEm(ret, 'cStat')
      const nota = notas.find(n => n.chaveAcesso === chave)
      const rotulo = nota ? `nº ${nota.numero ?? '-'} (${nota.emitenteNome || 'fornecedor'})` : (chave || 'nota')
      // 135 = registrado e vinculado; 136 = registrado sem vínculo; 573 = já estava registrado.
      if (cStat === '135' || cStat === '136' || cStat === '573') {
        if (nota) {
          await prisma.nfeRecebida.update({
            where: { id: nota.id },
            data: { manifestacao: TP_EVENTO_CIENCIA, manifestadaEm: agora },
          })
        }
        registradas++
      } else {
        falhas.push({ nota: rotulo, motivo: `[${cStat}] ${tagEm(ret, 'xMotivo') || 'sem motivo informado'}` })
      }
    }

    revalidatePath('/notas-fiscais/fornecedores')
    return { registradas, falhas }
  } catch (error) {
    return { registradas: 0, falhas: [], erro: formatarErro(error) }
  }
}
