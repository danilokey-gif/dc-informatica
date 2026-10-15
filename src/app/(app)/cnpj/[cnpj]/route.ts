import { NextRequest } from "next/server"
import { validarCnpj, type DadosCnpj } from "@/lib/cnpj"

export const dynamic = 'force-dynamic'

const juntar = (...partes: (string | null | undefined)[]) => partes.map(p => (p || '').trim()).filter(Boolean).join(' ')
// Sem User-Agent a BrasilAPI responde 403.
const CABECALHOS = { 'User-Agent': 'dc-informatica/1.0', Accept: 'application/json' }
const texto = (v: unknown) => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v))

async function brasilApi(cnpj: string): Promise<DadosCnpj | 'nao-encontrado'> {
  const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, { signal: AbortSignal.timeout(6000), cache: 'no-store', headers: CABECALHOS })
  if (r.status === 404) return 'nao-encontrado'
  if (!r.ok) throw new Error(`BrasilAPI HTTP ${r.status}`)
  const d = await r.json()
  return {
    cnpj,
    razaoSocial: texto(d.razao_social),
    nomeFantasia: texto(d.nome_fantasia),
    situacao: texto(d.descricao_situacao_cadastral).toUpperCase(),
    logradouro: juntar(d.descricao_tipo_de_logradouro, d.logradouro),
    numero: texto(d.numero),
    complemento: texto(d.complemento),
    bairro: texto(d.bairro),
    cep: texto(d.cep).replace(/\D/g, ''),
    municipio: texto(d.municipio),
    uf: texto(d.uf),
    codigoIbge: d.codigo_municipio_ibge ? String(d.codigo_municipio_ibge) : null,
    telefone: texto(d.ddd_telefone_1).replace(/\D/g, ''),
    email: texto(d.email).toLowerCase(),
  }
}

/** Reserva: CNPJ.ws (API pública, limite de 3 consultas por minuto). */
async function cnpjWs(cnpj: string): Promise<DadosCnpj | 'nao-encontrado'> {
  const r = await fetch(`https://publica.cnpj.ws/cnpj/${cnpj}`, { signal: AbortSignal.timeout(6000), cache: 'no-store', headers: CABECALHOS })
  if (r.status === 404 || r.status === 400) return 'nao-encontrado'
  if (!r.ok) throw new Error(`CNPJ.ws HTTP ${r.status}`)
  const d = await r.json()
  const e = d.estabelecimento || {}
  return {
    cnpj,
    razaoSocial: texto(d.razao_social),
    nomeFantasia: texto(e.nome_fantasia),
    situacao: texto(e.situacao_cadastral).toUpperCase(),
    logradouro: juntar(e.tipo_logradouro, e.logradouro),
    numero: texto(e.numero),
    complemento: texto(e.complemento),
    bairro: texto(e.bairro),
    cep: texto(e.cep).replace(/\D/g, ''),
    municipio: texto(e.cidade?.nome),
    uf: texto(e.estado?.sigla),
    codigoIbge: e.cidade?.ibge_id ? String(e.cidade.ibge_id) : null,
    telefone: `${texto(e.ddd1)}${texto(e.telefone1)}`.replace(/\D/g, ''),
    email: texto(e.email).toLowerCase(),
  }
}

/**
 * Consulta de CNPJ (dados públicos da Receita Federal) para preencher o cadastro de clientes e
 * fornecedores. Tenta a BrasilAPI e, se ela estiver fora do ar, a CNPJ.ws.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ cnpj: string }> }) {
  const cnpj = (await params).cnpj.replace(/\D/g, '')
  if (!validarCnpj(cnpj)) return Response.json({ erro: 'CNPJ inválido. Verifique os dígitos.' }, { status: 400 })

  for (const consulta of [brasilApi, cnpjWs]) {
    try {
      const dados = await consulta(cnpj)
      if (dados === 'nao-encontrado') return Response.json({ erro: 'CNPJ não encontrado na Receita Federal.' }, { status: 404 })
      return Response.json(dados)
    } catch (erro) {
      console.warn('[CNPJ] Serviço indisponível, tentando o próximo:', erro)
    }
  }
  return Response.json({ erro: 'Os serviços de consulta de CNPJ não responderam. Preencha os dados à mão.' }, { status: 503 })
}
