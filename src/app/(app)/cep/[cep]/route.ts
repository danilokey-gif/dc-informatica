import { NextRequest } from "next/server"
import tabelasIbge from "@/lib/nfse/tabelas-ibge.json"
import type { EnderecoCep } from "@/lib/cep"

export const dynamic = 'force-dynamic'

const MUNICIPIOS = tabelasIbge.municipios as Record<string, string>
const UFS = tabelasIbge.ufs as Record<string, string>

const semAcento = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

/** Código IBGE pelo nome do município + UF, na tabela oficial (usado quando o serviço não devolve o código). */
function codigoPorNome(municipio: string, uf: string): string | null {
  const alvo = semAcento(municipio)
  for (const [codigo, nome] of Object.entries(MUNICIPIOS)) {
    if (UFS[codigo.slice(0, 2)] === uf && semAcento(nome) === alvo) return codigo
  }
  return null
}

async function viaCep(cep: string): Promise<EnderecoCep | 'nao-encontrado'> {
  const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: AbortSignal.timeout(4000), cache: 'no-store' })
  if (!r.ok) throw new Error(`ViaCEP HTTP ${r.status}`)
  const d = await r.json()
  if (d.erro) return 'nao-encontrado'
  return { cep, logradouro: d.logradouro || '', bairro: d.bairro || '', municipio: d.localidade || '', uf: d.uf || '', codigoIbge: d.ibge || null }
}

async function brasilApi(cep: string): Promise<EnderecoCep | 'nao-encontrado'> {
  const r = await fetch(`https://brasilapi.com.br/api/cep/v1/${cep}`, { signal: AbortSignal.timeout(4000), cache: 'no-store' })
  if (r.status === 404) return 'nao-encontrado'
  if (!r.ok) throw new Error(`BrasilAPI HTTP ${r.status}`)
  const d = await r.json()
  // Alguns provedores da BrasilAPI trazem o código IBGE em ibge.city; quando não trazem, ele é
  // achado pelo nome do município na tabela oficial (veja codigoPorNome).
  return { cep, logradouro: d.street || '', bairro: d.neighborhood || '', municipio: d.city || '', uf: d.state || '', codigoIbge: d.ibge?.city || null }
}

/**
 * Consulta de CEP para preencher o endereço. Tenta o ViaCEP e, se ele estiver fora do ar, a
 * BrasilAPI. O código IBGE é conferido na tabela oficial: um código que não existe nela faz a
 * nota fiscal ser recusada (regra E0238 da NFS-e).
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ cep: string }> }) {
  const cep = (await params).cep.replace(/\D/g, '')
  if (cep.length !== 8) return Response.json({ erro: 'O CEP precisa ter 8 dígitos.' }, { status: 400 })

  let endereco: EnderecoCep | 'nao-encontrado' | null = null
  for (const consulta of [viaCep, brasilApi]) {
    try {
      endereco = await consulta(cep)
      break
    } catch (erro) {
      console.warn('[CEP] Serviço indisponível, tentando o próximo:', erro)
    }
  }

  if (endereco === null) return Response.json({ erro: 'Os serviços de CEP não responderam. Preencha o endereço à mão.' }, { status: 503 })
  if (endereco === 'nao-encontrado') return Response.json({ erro: 'CEP não encontrado.' }, { status: 404 })

  if (!endereco.codigoIbge || !MUNICIPIOS[endereco.codigoIbge]) {
    endereco.codigoIbge = codigoPorNome(endereco.municipio, endereco.uf)
  }
  return Response.json(endereco)
}
