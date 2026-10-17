'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { gtinValido } from "@/lib/gtin"
import ncmVigentes from "@/lib/ncm-vigentes.json"

const NCMS = new Set((ncmVigentes as { ncms: string[] }).ncms)

// ───────────── leitura do XML (mesmo jeito do DANFE: só o que está na nota) ─────────────

function bloco(xml: string | null | undefined, nome: string): string | null {
  if (!xml) return null
  return xml.match(new RegExp(`<${nome}(?:\\s[^>]*)?>([\\s\\S]*?)</${nome}>`))?.[1] ?? null
}
function blocos(xml: string | null | undefined, nome: string): string[] {
  if (!xml) return []
  return [...xml.matchAll(new RegExp(`<${nome}(?:\\s[^>]*)?>([\\s\\S]*?)</${nome}>`, 'g'))].map(m => m[1])
}
function tag(xml: string | null | undefined, nome: string): string {
  const v = xml?.match(new RegExp(`<${nome}(?:\\s[^>]*)?>([^<]*)</${nome}>`))?.[1] ?? ''
  // XML de fornecedor às vezes vem com espaços sobrando, que depois derrubam a NF-e (rejeição 225).
  return v.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()
}
const num = (v: string) => (v ? Number(v) || 0 : 0)
const centavos = (v: number) => Math.round(v * 100) / 100

function formatarCnpj(d: string) {
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  return d
}
/** Telefone do XML formatado; vazio quando é falso ("00000000", só DDD...). */
function formatarTelefone(f: string): string | null {
  const d = f.replace(/\D/g, '').replace(/^0/, '')
  if (d.length < 10 || /^0+$/.test(d) || /^(\d)+$/.test(d)) return null
  if (d.length === 10) return d.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3')
  if (d.length === 11) return d.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3')
  return null
}

export interface ItemImportado {
  nome: string
  quantidade: number
  custoUnitario: number
  novo: boolean
  /** Campos preenchidos a partir do XML (ex.: "NCM 8528.62.00", "código de barras"). */
  preenchidos: string[]
  avisos: string[]
}

export interface ResultadoImportacao {
  error?: string
  success?: boolean
  numero?: string
  fornecedor?: string
  fornecedorNovo?: boolean
  itens?: ItemImportado[]
  financeiro?: string
}

/**
 * Entrada de estoque pelo XML da NF-e de compra. Aproveita tudo o que a nota traz: código do
 * fornecedor, descrição, NCM, código de barras (GTIN), custo real (com IPI, ST, frete, seguro e
 * outras despesas, menos desconto), fornecedor (cadastrado ou atualizado pelo CNPJ) e as
 * duplicatas, que viram contas a pagar. A mesma nota não entra duas vezes.
 */
export async function processXmlUpload(formData: FormData): Promise<ResultadoImportacao> {
  const file = formData.get('xmlFile') as File | null
  if (!file) return { error: 'Nenhum arquivo enviado.' }
  const lancarFinanceiro = formData.get('lancarFinanceiro') === '1'
  const xml = await file.text()

  const infNFe = bloco(xml, 'infNFe')
  if (!infNFe) return { error: 'XML inválido ou não é uma NF-e reconhecida.' }
  const chave = xml.match(/Id="NFe(\d{44})"/)?.[1]
  if (!chave) return { error: 'Não encontrei a chave de acesso no XML.' }

  const ide = bloco(infNFe, 'ide')
  const emit = bloco(infNFe, 'emit')
  const enderEmit = bloco(emit, 'enderEmit')
  const total = bloco(bloco(infNFe, 'total'), 'ICMSTot')
  const numero = tag(ide, 'nNF')
  const emitCnpj = tag(emit, 'CNPJ') || tag(emit, 'CPF')
  const emitNome = tag(emit, 'xNome')
  const dataEmissao = tag(ide, 'dhEmi') ? new Date(tag(ide, 'dhEmi')) : new Date()

  const jaLancada = await prisma.nfeRecebida.findUnique({ where: { chaveAcesso: chave }, select: { entradaEstoqueEm: true } })
  if (jaLancada?.entradaEstoqueEm) {
    return { error: `A NF-e nº ${numero} de ${emitNome} já deu entrada no estoque em ${jaLancada.entradaEstoqueEm.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}. Para não duplicar o estoque, ela não foi lançada de novo.` }
  }

  try {
    return await prisma.$transaction(async tx => {
      // ── fornecedor: pelo CNPJ (aceita cadastro com ou sem pontuação)
      const [existente] = emitCnpj
        ? await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Supplier" WHERE regexp_replace(coalesce("document", ''), '[^0-9]', '', 'g') = ${emitCnpj} LIMIT 1`
        : []
      const endereco = [[tag(enderEmit, 'xLgr'), tag(enderEmit, 'nro')].filter(Boolean).join(', '), tag(enderEmit, 'xBairro'), `${tag(enderEmit, 'xMun')}/${tag(enderEmit, 'UF')}`, tag(enderEmit, 'CEP') && `CEP ${tag(enderEmit, 'CEP').replace(/^(\d{5})(\d{3})$/, '$1-$2')}`].filter(Boolean).join(' - ')
      let fornecedorId: string | null = existente?.id ?? null
      let fornecedorNovo = false
      if (fornecedorId) {
        // Completa só o que estiver vazio no cadastro.
        const f = await tx.supplier.findUniqueOrThrow({ where: { id: fornecedorId } })
        await tx.supplier.update({
          where: { id: fornecedorId },
          data: {
            phone: f.phone || formatarTelefone(tag(enderEmit, 'fone')),
            address: f.address || endereco || null,
            email: f.email || tag(emit, 'email') || null,
          },
        })
      } else if (emitCnpj) {
        const f = await tx.supplier.create({
          data: {
            name: tag(emit, 'xFant') || emitNome,
            document: formatarCnpj(emitCnpj),
            phone: formatarTelefone(tag(enderEmit, 'fone')),
            address: endereco || null,
            email: tag(emit, 'email') || null,
          },
        })
        fornecedorId = f.id
        fornecedorNovo = true
      }

      // ── produtos
      const itens: ItemImportado[] = []
      for (const det of blocos(infNFe, 'det')) {
        const prod = bloco(det, 'prod')
        const imposto = bloco(det, 'imposto')
        const nome = tag(prod, 'xProd')
        const sku = tag(prod, 'cProd')
        const quantidade = num(tag(prod, 'qCom'))
        const ncm = tag(prod, 'NCM')
        const ean = [tag(prod, 'cEAN'), tag(prod, 'cEANTrib')].find(g => gtinValido(g)) || null
        // Custo real de cada unidade: produto + IPI + ICMS-ST + FCP-ST + frete + seguro + outras − desconto.
        const custoTotal = num(tag(prod, 'vProd')) + num(tag(bloco(imposto, 'IPI'), 'vIPI')) + num(tag(bloco(imposto, 'ICMS'), 'vICMSST'))
          + num(tag(bloco(imposto, 'ICMS'), 'vFCPST')) + num(tag(prod, 'vFrete')) + num(tag(prod, 'vSeg')) + num(tag(prod, 'vOutro')) - num(tag(prod, 'vDesc'))
        const custoUnitario = quantidade > 0 ? centavos(custoTotal / quantidade) : num(tag(prod, 'vUnCom'))
        const ncmOk = ncm && NCMS.has(ncm) ? ncm : null
        const avisos: string[] = []
        if (ncm && !ncmOk) avisos.push(`NCM ${ncm} da nota não está na tabela vigente — confira no cadastro.`)
        if (tag(prod, 'uCom') && tag(prod, 'uTrib') && tag(prod, 'uCom') !== tag(prod, 'uTrib')) avisos.push(`Unidade da nota: ${tag(prod, 'uCom')} (confira se a quantidade é em unidades).`)

        const condicoes = [{ sku }, { name: nome }, ...(ean ? [{ gtin: ean }] : [])]
        const atual = await tx.product.findFirst({ where: { OR: condicoes } })
        const preenchidos: string[] = []
        if (atual) {
          const dados: Record<string, unknown> = { stockQty: { increment: quantidade } }
          if (custoUnitario > 0) { dados.costPrice = custoUnitario; preenchidos.push('custo') }
          if (!atual.ncm && ncmOk) { dados.ncm = ncmOk; preenchidos.push(`NCM ${ncmOk}`) }
          if (!atual.gtin && ean) { dados.gtin = ean; preenchidos.push('código de barras') }
          if (!atual.sku && sku) { dados.sku = sku; preenchidos.push('código') }
          if (!atual.cfop) { dados.cfop = '5102'; preenchidos.push('CFOP 5102') }
          await tx.product.update({ where: { id: atual.id }, data: dados })
          itens.push({ nome: atual.name, quantidade, custoUnitario, novo: false, preenchidos, avisos })
        } else {
          await tx.product.create({
            data: {
              name: nome,
              sku: sku || null,
              ncm: ncmOk,
              gtin: ean,
              // CFOP da nossa venda (revenda dentro de SP), não o da nota do fornecedor.
              cfop: '5102',
              costPrice: custoUnitario,
              salePrice: centavos(custoUnitario * 1.5), // margem padrão de 50%: ajuste em Produtos
              stockQty: quantidade,
              category: 'Importado via XML',
              minStockAlert: 1,
            },
          })
          preenchidos.push('código', 'custo', 'preço de venda (+50%)', 'CFOP 5102')
          if (ncmOk) preenchidos.push(`NCM ${ncmOk}`)
          if (ean) preenchidos.push('código de barras')
          itens.push({ nome, quantidade, custoUnitario, novo: true, preenchidos, avisos })
        }
      }

      // ── contas a pagar: uma por duplicata; sem duplicata, a nota foi à vista
      let financeiro: string | undefined
      if (lancarFinanceiro) {
        const dups = blocos(bloco(infNFe, 'cobr'), 'dup')
        const base = { type: 'DESPESA', supplierId: fornecedorId, notes: `NF-e ${numero} — chave ${chave}` }
        if (dups.length) {
          for (const [i, d] of dups.entries()) {
            await tx.financeTransaction.create({
              data: {
                ...base,
                description: `Compra NF-e ${numero} - ${emitNome}${dups.length > 1 ? ` (Parc. ${i + 1}/${dups.length})` : ''}`,
                amount: num(tag(d, 'vDup')),
                dueDate: new Date(`${tag(d, 'dVenc') || dataEmissao.toISOString().slice(0, 10)}T12:00:00.000Z`),
                status: 'PENDENTE',
                paymentMethod: 'Boleto',
              },
            })
          }
          financeiro = `${dups.length} conta(s) a pagar lançada(s) no Financeiro, com os vencimentos das duplicatas.`
        } else {
          await tx.financeTransaction.create({
            data: { ...base, description: `Compra NF-e ${numero} - ${emitNome}`, amount: num(tag(total, 'vNF')), dueDate: dataEmissao, paidDate: dataEmissao, status: 'PAGO' },
          })
          financeiro = 'A nota não tem duplicatas: lançada no Financeiro como despesa paga à vista.'
        }
      }

      // ── guarda a nota em "Notas de Compra" e marca a entrada no estoque
      await tx.nfeRecebida.upsert({
        where: { chaveAcesso: chave },
        create: {
          chaveAcesso: chave, emitenteCnpj: emitCnpj || null, emitenteNome: emitNome || null, emitenteIe: tag(emit, 'IE') || null,
          numero: Number(numero) || null, serie: tag(ide, 'serie') || null, valorTotal: num(tag(total, 'vNF')), dataEmissao,
          completa: true, xml, origem: 'IMPORTADA_XML', entradaEstoqueEm: new Date(),
        },
        update: { completa: true, xml, entradaEstoqueEm: new Date() },
      })

      return { success: true, numero, fornecedor: emitNome, fornecedorNovo, itens, financeiro }
    }, { timeout: 30000 })
  } catch (err: any) {
    console.error(err)
    return { error: 'Falha ao ler o arquivo XML: ' + err.message }
  } finally {
    revalidatePath('/produtos')
    revalidatePath('/financeiro')
    revalidatePath('/notas-fiscais/fornecedores')
  }
}

export async function registerManualEntry(formData: FormData) {
  const itemsRaw = formData.get('items') as string

  if (!itemsRaw) return

  const items = JSON.parse(itemsRaw) as { productId: string, quantity: number, unitCost: number }[]

  // Process the entry in a transaction to ensure all products are updated
  await prisma.$transaction(
    items.map(item =>
      prisma.product.update({
        where: { id: item.productId },
        data: {
          stockQty: { increment: item.quantity },
          costPrice: item.unitCost > 0 ? item.unitCost : undefined // Only update cost if provided
        }
      })
    )
  )

  revalidatePath('/produtos')
  redirect('/produtos')
}
