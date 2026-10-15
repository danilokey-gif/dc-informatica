import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import tabelasIbge from "@/lib/nfse/tabelas-ibge.json"
import type { DadosDocumento } from "@/lib/cnpj"

export const dynamic = 'force-dynamic'

const MUNICIPIOS = tabelasIbge.municipios as Record<string, string>
const UFS = tabelasIbge.ufs as Record<string, string>

function bloco(xml: string, nome: string): string | null {
  return xml.match(new RegExp(`<${nome}(?:\\s[^>]*)?>([\\s\\S]*?)</${nome}>`))?.[1] ?? null
}
function tag(xml: string | null, nome: string): string {
  const v = xml?.match(new RegExp(`<${nome}>([^<]*)</${nome}>`))?.[1] ?? ''
  return v.trim().replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
}

/** Tomador de uma NFS-e (DPS) ou destinatário de uma NF-e, se for o documento procurado. */
function daNota(xml: string, grupo: 'toma' | 'dest', doc: string, data: Date, origem: string): DadosDocumento | null {
  const g = bloco(xml, grupo)
  if (!g || (tag(g, 'CPF') || tag(g, 'CNPJ')) !== doc || !tag(g, 'xNome')) return null
  const end = grupo === 'toma' ? bloco(g, 'end') : bloco(g, 'enderDest')
  const codigoIbge = tag(end, 'cMun') || null
  return {
    origem: `${origem} de ${data.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
    nome: tag(g, 'xNome'),
    telefone: tag(g, 'fone').replace(/\D/g, '') || tag(end, 'fone').replace(/\D/g, ''),
    email: tag(g, 'email').toLowerCase(),
    logradouro: tag(end, 'xLgr'),
    numero: tag(end, 'nro'),
    complemento: tag(end, 'xCpl'),
    bairro: tag(end, 'xBairro'),
    cep: tag(end, 'CEP'),
    municipio: (codigoIbge && MUNICIPIOS[codigoIbge]) || tag(end, 'xMun'),
    uf: (codigoIbge && UFS[codigoIbge.slice(0, 2)]) || tag(end, 'UF'),
    codigoIbge,
  }
}

/**
 * Procura um CPF/CNPJ no que o próprio sistema já conhece: clientes cadastrados e notas emitidas
 * (tomador das NFS-e, destinatário das NF-e). Não há base pública de CPF; isto cobre quem já foi
 * cliente alguma vez.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ doc: string }> }) {
  const doc = (await params).doc.replace(/\D/g, '')
  if (doc.length !== 11 && doc.length !== 14) return Response.json({ erro: 'Documento precisa ter 11 (CPF) ou 14 (CNPJ) dígitos.' }, { status: 400 })

  const clientes = await prisma.$queryRaw<{ id: string; name: string }[]>`
    SELECT "id", "name" FROM "Customer" WHERE regexp_replace(coalesce("document", ''), '[^0-9]', '', 'g') = ${doc} ORDER BY "createdAt" LIMIT 1`

  const [nfses, nfes] = await Promise.all([
    prisma.nfseEmissao.findMany({
      where: { xmlNfse: { contains: `>${doc}</` } },
      select: { xmlNfse: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 5,
    }),
    prisma.nfeEmissao.findMany({
      where: { xmlNfe: { contains: `>${doc}</` } },
      select: { xmlNfe: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 5,
    }),
  ])
  // A nota mais recente vence; entre as duas, a que tiver endereço.
  const candidatos = [
    ...nfes.map(n => n.xmlNfe && daNota(n.xmlNfe, 'dest', doc, n.createdAt, 'NF-e')),
    ...nfses.map(n => n.xmlNfse && daNota(n.xmlNfse, 'toma', doc, n.createdAt, 'NFS-e')),
  ].filter((c): c is DadosDocumento => !!c)
  const dados = candidatos.find(c => c.logradouro) ?? candidatos[0] ?? null

  return Response.json({ cliente: clientes[0] ?? null, dados })
}
