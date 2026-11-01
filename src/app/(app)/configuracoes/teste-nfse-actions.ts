'use server'

import { getCompanySettings, getNfseConfig } from "@/lib/settings"
import { getCurrentUser } from "@/lib/auth"
import { decryptSecret } from "@/lib/crypto"
import { extractCertMaterial } from "@/lib/nfse/certificate"
import { NfseClient } from "@/lib/nfse/client"
import { montarXmlDps, assinarDps } from "@/lib/nfse/dps"

/** Série só para estes testes, separada da série das notas reais. */
const SERIE_TESTE = '8999' // o esquema novo reserva as séries 90000 a 99999

/**
 * Envia uma NFS-e de teste no leiaute da Reforma Tributária (NT 009/2026) para a HOMOLOGAÇÃO
 * (produção restrita, sem valor fiscal). Não usa a numeração das notas reais e não grava nada:
 * só diz se a Sefin aceitou o leiaute novo ou por que recusou.
 */
export async function testarLeiauteNovoHomologacao(): Promise<{ ok: boolean; mensagem: string }> {
  const user = await getCurrentUser()
  if (user?.role !== 'ADMIN') return { ok: false, mensagem: 'Só o administrador pode fazer o teste.' }

  try {
    const [empresa, cfg] = await Promise.all([getCompanySettings(), getNfseConfig()])
    if (!cfg.certificado || !cfg.certificadoSenha) return { ok: false, mensagem: 'Certificado digital não configurado.' }
    if (!cfg.codigoMunicipio || !cfg.codigoServico || !empresa.document) {
      return { ok: false, mensagem: 'Configuração incompleta (município, código de serviço ou CNPJ da empresa).' }
    }

    const pfx = Buffer.from(cfg.certificado, 'base64')
    const senha = decryptSecret(cfg.certificadoSenha)
    const cert = extractCertMaterial(pfx, senha)

    // Número que não se repete entre um teste e outro (segundos desde 2026).
    const numero = Math.floor((Date.now() - Date.UTC(2026, 0, 1)) / 1000)
    const { xml, id } = montarXmlDps({
      ambiente: 'homologacao',
      codigoMunicipio: cfg.codigoMunicipio,
      serie: SERIE_TESTE,
      numero,
      dataCompetencia: new Date(),
      prestador: { documento: empresa.document },
      tomador: {
        documento: empresa.document,
        nome: 'TESTE DE LEIAUTE - SEM VALOR FISCAL',
        endereco: empresa.enderLogradouro && empresa.enderNumero && empresa.enderBairro && empresa.enderCep
          ? { codigoMunicipio: cfg.codigoMunicipio, cep: empresa.enderCep.replace(/\D/g, ''), logradouro: empresa.enderLogradouro, numero: empresa.enderNumero, bairro: empresa.enderBairro }
          : undefined,
      },
      servico: { codigoTributacaoNacional: cfg.codigoServico, descricao: 'Teste do leiaute da Reforma Tributaria (NT 009/2026) - sem valor fiscal', valor: 1 },
      aliquotaIss: cfg.aliquotaIss ?? 0,
      regimeTributario: cfg.regimeTributario as 'MEI' | 'SIMPLES' | 'NORMAL',
      leiaute: 'nt009',
      rtc: { cIndOp: cfg.cIndOp, cNbs: cfg.cNbs },
    })

    const client = new NfseClient({ ambiente: 'homologacao', pfxBuffer: pfx, certPassword: senha })
    const resposta = await client.emitirNfse(assinarDps(xml, id, cert))
    const nNFSe = resposta.xmlNfse?.match(/<nNFSe>(\d+)<\/nNFSe>/)?.[1]
    const temIbsCbs = /<IBSCBS>/.test(resposta.xmlNfse || '')
    return {
      ok: true,
      mensagem: `A homologação aceitou o leiaute novo${nNFSe ? ` (nota de teste nº ${nNFSe})` : ''}.` +
        (temIbsCbs ? ' A nota voltou com o quadro de IBS/CBS calculado.' : ''),
    }
  } catch (e) {
    return { ok: false, mensagem: e instanceof Error ? e.message : String(e) }
  }
}
