import { createHmac, timingSafeEqual } from 'crypto'
import { headers } from 'next/headers'
import { prisma } from './prisma'

/**
 * Envio de nota fiscal por WhatsApp. O WhatsApp não deixa um site anexar arquivo numa conversa,
 * então a mensagem leva um link para o PDF. Esse link abre sem login (o cliente não tem senha),
 * por isso carrega uma assinatura feita com o AUTH_SECRET: só quem recebeu o link de uma nota
 * consegue abrir aquela nota, e não dá para adivinhar o link de outra.
 */
export type TipoNota = 'nfse' | 'nfe'
const LETRA: Record<TipoNota, string> = { nfse: 's', nfe: 'p' }

function assinatura(tipo: TipoNota, id: string) {
  const segredo = process.env.AUTH_SECRET
  if (!segredo) throw new Error('AUTH_SECRET não configurado')
  return createHmac('sha256', segredo).update(`nota-publica:${tipo}:${id}`).digest('base64url').slice(0, 32)
}

export function tokenDaNota(tipo: TipoNota, id: string) {
  return `${LETRA[tipo]}-${id}-${assinatura(tipo, id)}`
}

/** Devolve a nota do token, ou null se o link não for autêntico. */
export function lerTokenDaNota(token: string): { tipo: TipoNota; id: string } | null {
  const m = token.match(/^([sp])-([a-z0-9]{10,40})-([A-Za-z0-9_-]{32})$/)
  if (!m) return null
  const tipo: TipoNota = m[1] === 's' ? 'nfse' : 'nfe'
  const esperado = Buffer.from(assinatura(tipo, m[2])), recebido = Buffer.from(m[3])
  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido) ? { tipo, id: m[2] } : null
}

/** Endereço do site como o navegador o vê (para montar o link que vai na mensagem). */
export async function origemDoSite() {
  const h = await headers()
  return `${h.get('x-forwarded-proto') || 'https'}://${h.get('host')}`
}

/** Telefone no formato do WhatsApp (55 + DDD + número), ou null se não for um telefone brasileiro válido. */
export function telefoneWhatsApp(telefone: string | null | undefined): string | null {
  let d = (telefone || '').replace(/\D/g, '').replace(/^0+/, '')
  if (d.length >= 12 && d.startsWith('55')) d = d.slice(2)
  return d.length === 10 || d.length === 11 ? `55${d}` : null
}

/** Telefones dos clientes por CPF/CNPJ (só números), para as notas que não têm OS/venda ligada. */
export async function telefonesPorDocumento(): Promise<Map<string, string>> {
  const clientes = await prisma.customer.findMany({ where: { phone: { not: null }, document: { not: null } }, select: { phone: true, document: true } })
  const mapa = new Map<string, string>()
  for (const c of clientes) {
    const doc = (c.document || '').replace(/\D/g, ''), tel = telefoneWhatsApp(c.phone)
    if (doc.length >= 11 && tel) mapa.set(doc, tel)
  }
  return mapa
}

const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export interface EnvioWhatsApp {
  /** Mensagem sem o link (usada quando o próprio PDF vai anexado, no celular). */
  texto: string
  /** wa.me com a mensagem + link do PDF. */
  linkWhatsApp: string
  temTelefone: boolean
}

export function montarEnvioWhatsApp(d: {
  tipo: TipoNota
  id: string
  numero: string
  valor: number | null
  empresa: string
  telefone: string | null
  origem: string
  cancelada?: boolean
}): EnvioWhatsApp {
  const nome = d.tipo === 'nfse' ? 'nota fiscal de serviço (NFS-e)' : 'nota fiscal (NF-e)'
  const texto = `Olá! Segue a ${nome} nº ${d.numero} da ${d.empresa}${d.valor ? `, no valor de ${moeda(d.valor)}` : ''}.${d.cancelada ? ' Esta nota foi cancelada.' : ''}`
  const completa = `${texto}\n\n📄 PDF da nota: ${d.origem}/nota/${tokenDaNota(d.tipo, d.id)}\n\nQualquer dúvida, é só chamar.`
  return {
    texto,
    linkWhatsApp: `https://wa.me/${d.telefone || ''}?text=${encodeURIComponent(completa)}`,
    temTelefone: !!d.telefone,
  }
}

/** Tudo que o botão de WhatsApp precisa para uma nota (telas que mostram uma nota só). */
export async function envioDaNota(tipo: TipoNota, id: string): Promise<(EnvioWhatsApp & { urlPdf: string; nomeArquivo: string }) | null> {
  const empresa = await prisma.companySettings.findUnique({ where: { id: 'main' }, select: { name: true, nomeFantasia: true } })
  const nomeEmpresa = empresa?.nomeFantasia || empresa?.name || 'nossa empresa'
  const origem = await origemDoSite()
  const telefoneDe = async (telefone: string | null | undefined, documento: string | null | undefined) =>
    telefoneWhatsApp(telefone) || (await telefonesPorDocumento()).get((documento || '').replace(/\D/g, '')) || null

  if (tipo === 'nfse') {
    const n = await prisma.nfseEmissao.findUnique({
      where: { id },
      select: { status: true, ambiente: true, numeroNfse: true, numeroDps: true, valorTotal: true, tomadorDocumento: true, xmlNfse: true, serviceOrder: { select: { price: true, customer: { select: { phone: true, document: true } } } } },
    })
    if (!n?.xmlNfse || n.ambiente !== 'producao' || !['AUTORIZADA', 'CANCELADA'].includes(n.status)) return null
    const numero = String(n.numeroNfse ?? n.numeroDps)
    return {
      ...montarEnvioWhatsApp({
        tipo, id, numero, valor: n.valorTotal ?? n.serviceOrder?.price ?? null, empresa: nomeEmpresa, origem, cancelada: n.status === 'CANCELADA',
        telefone: await telefoneDe(n.serviceOrder?.customer.phone, n.tomadorDocumento || n.serviceOrder?.customer.document),
      }),
      urlPdf: `/notas-fiscais/danfse-pdf?id=${id}`, nomeArquivo: `NFS-e-${numero}.pdf`,
    }
  }
  const n = await prisma.nfeEmissao.findUnique({
    where: { id },
    select: { status: true, ambiente: true, numero: true, valorTotal: true, destinatarioDocumento: true, xmlNfe: true, sale: { select: { total: true, customer: { select: { phone: true, document: true } } } } },
  })
  if (!n?.xmlNfe || n.ambiente !== 'producao' || !['AUTORIZADA', 'CANCELADA'].includes(n.status)) return null
  return {
    ...montarEnvioWhatsApp({
      tipo, id, numero: String(n.numero), valor: n.valorTotal ?? n.sale?.total ?? null, empresa: nomeEmpresa, origem, cancelada: n.status === 'CANCELADA',
      telefone: await telefoneDe(n.sale?.customer?.phone, n.destinatarioDocumento || n.sale?.customer?.document),
    }),
    urlPdf: `/notas-fiscais/danfe-pdf?id=${id}`, nomeArquivo: `NF-e-${n.numero}.pdf`,
  }
}
