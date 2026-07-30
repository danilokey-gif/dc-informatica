'use server'

import { prisma } from "@/lib/prisma"
import { getNfeConfig, getNfseConfig, getCompanySettings } from "@/lib/settings"
import { decryptSecret } from "@/lib/crypto"
import { NfeSoapClient } from "@/lib/nfe/soap-client"
import { parseRetDistDFeInt } from "@/lib/nfe/distribuicao"
import { AdnClient } from "@/lib/nfse/adn-client"
import { gunzipSync } from "zlib"
import { revalidatePath } from "next/cache"

const MAX_PAGINAS_NFE = 20 // até 50 documentos por página -> até 1000 por clique
const MAX_TENTATIVAS_NFSE = 200 // NSU consultado um a um -> limite de chamadas por clique
const MAX_NAO_ENCONTRADOS_SEGUIDOS = 10 // pára de tentar depois de N NSUs vazios seguidos

export async function sincronizarNfeGoverno(): Promise<{ novos: number; mensagem: string }> {
  const [nfeConfig, empresa] = await Promise.all([getNfeConfig(), getCompanySettings()])

  if (!nfeConfig.certificado || !nfeConfig.certificadoSenha) {
    throw new Error('Certificado digital da NF-e não configurado. Vá em Configurações > Nota Fiscal de Produtos.')
  }
  if (!empresa.document) {
    throw new Error('CNPJ da empresa não configurado.')
  }

  const pfxBuffer = Buffer.from(nfeConfig.certificado, 'base64')
  const certSenha = decryptSecret(nfeConfig.certificadoSenha)
  const ambiente = nfeConfig.ambiente === 'producao' ? 'producao' : 'homologacao'
  const client = new NfeSoapClient({ ambiente, pfxBuffer, certPassword: certSenha })

  let ultNsu = nfeConfig.ultimoNsu || '000000000000000'
  let novos = 0

  for (let pagina = 0; pagina < MAX_PAGINAS_NFE; pagina++) {
    const respostaXml = await client.consultarDistribuicaoDFe(
      empresa.document.replace(/\D/g, ''),
      nfeConfig.uf,
      ambiente === 'producao' ? '1' : '2',
      ultNsu
    )
    const resultado = parseRetDistDFeInt(respostaXml)

    if (resultado.cStat !== '138' && resultado.cStat !== '137') {
      // 137 = nenhum documento localizado (não é erro, só não tem nada novo); qualquer outro cStat é rejeição.
      if (resultado.cStat === '137') break
      throw new Error(`[${resultado.cStat}] ${resultado.xMotivo}`)
    }

    for (const doc of resultado.documentos) {
      const existente = await prisma.nfeEmissao.findUnique({ where: { chaveAcesso: doc.chaveAcesso } })
      if (existente) continue

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
        }
      })
      novos++
    }

    ultNsu = resultado.ultNSU
    await prisma.nfeConfig.update({ where: { id: 'main' }, data: { ultimoNsu: ultNsu } })

    if (resultado.ultNSU === resultado.maxNSU || resultado.documentos.length === 0) break
  }

  revalidatePath('/notas-fiscais')
  return { novos, mensagem: `${novos} nota(s) de produto importada(s) do governo.` }
}

export async function sincronizarNfseGoverno(): Promise<{ novos: number; mensagem: string }> {
  const nfseConfig = await getNfseConfig()

  if (!nfseConfig.certificado || !nfseConfig.certificadoSenha) {
    throw new Error('Certificado digital da NFS-e não configurado. Vá em Configurações > Nota Fiscal de Serviço.')
  }

  const pfxBuffer = Buffer.from(nfseConfig.certificado, 'base64')
  const certSenha = decryptSecret(nfseConfig.certificadoSenha)
  const ambiente = nfseConfig.ambiente === 'producao' ? 'producao' : 'homologacao'
  const client = new AdnClient({ ambiente, pfxBuffer, certPassword: certSenha })

  let nsuAtual = BigInt(nfseConfig.ultimoNsu || '000000000000000') + BigInt(1)
  let novos = 0
  let naoEncontradosSeguidos = 0

  for (let tentativa = 0; tentativa < MAX_TENTATIVAS_NFSE; tentativa++) {
    const nsuStr = nsuAtual.toString().padStart(15, '0')
    const resposta = await client.consultarDFePorNsu(nsuStr)

    if (!resposta) {
      naoEncontradosSeguidos++
      if (naoEncontradosSeguidos >= MAX_NAO_ENCONTRADOS_SEGUIDOS) break
      nsuAtual++
      continue
    }
    naoEncontradosSeguidos = 0

    // Formato exato do JSON ainda não confirmado contra uma chamada real — tenta os nomes de
    // campo mais prováveis, seguindo a convenção já usada na emissão (`nfseXmlGZipB64`).
    const conteudoBase64 = (resposta.arquivoXmlGZipB64 || resposta.nfseXmlGZipB64 || resposta.documentoXmlGZipB64 || resposta.arquivo || resposta.conteudo) as string | undefined

    if (!conteudoBase64) {
      throw new Error(`Formato de resposta do ADN não reconhecido no NSU ${nsuStr}. Campos recebidos: ${Object.keys(resposta).join(', ')}. Avise para eu ajustar a leitura.`)
    }

    const xml = gunzipSync(Buffer.from(conteudoBase64, 'base64')).toString('utf-8')
    const chaveAcesso = xml.match(/<chNFSe>(\d{50})<\/chNFSe>/)?.[1] || xml.match(/Id="NFSe(\d{50})"/)?.[1] || ''

    if (chaveAcesso) {
      const existente = await prisma.nfseEmissao.findUnique({ where: { chaveAcesso } })
      if (!existente) {
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
          }
        })
        novos++
      }
    }

    await prisma.nfseConfig.update({ where: { id: 'main' }, data: { ultimoNsu: nsuStr } })
    nsuAtual++
  }

  revalidatePath('/notas-fiscais')
  return { novos, mensagem: `${novos} nota(s) de serviço importada(s) do governo.` }
}
