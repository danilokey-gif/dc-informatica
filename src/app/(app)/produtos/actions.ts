'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { gtinValido } from "@/lib/gtin"

/** GTIN só com dígitos; vazio vira null (= "SEM GTIN" na NF-e). Dígito errado é recusado. */
function lerGtin(formData: FormData): string | null {
  const gtin = ((formData.get('gtin') as string) || '').replace(/\D/g, '')
  if (!gtin) return null
  if (!gtinValido(gtin)) throw new Error(`Código de barras ${gtin} inválido: o dígito verificador não confere.`)
  return gtin
}

export async function createProduct(formData: FormData) {
  const name = ((formData.get('name') as string) || '').replace(/\s+/g, ' ').trim()
  const sku = ((formData.get('sku') as string) || '').trim() || null
  const category = (formData.get('category') as string) || null
  const description = (formData.get('description') as string) || null
  const costPrice = parseFloat(formData.get('costPrice') as string) || 0
  const salePrice = parseFloat(formData.get('salePrice') as string) || 0
  const stockQty = parseInt(formData.get('stockQty') as string) || 0
  const minStockAlert = parseInt(formData.get('minStockAlert') as string) || 0
  const ncm = (formData.get('ncm') as string) || null
  const cfop = (formData.get('cfop') as string) || null
  const gtin = lerGtin(formData)

  await prisma.product.create({
    data: { name, sku, category, description, costPrice, salePrice, stockQty, minStockAlert, ncm, cfop, gtin }
  })

  redirect('/produtos')
}

export async function updateProduct(id: string, formData: FormData) {
  const name = ((formData.get('name') as string) || '').replace(/\s+/g, ' ').trim()
  const sku = ((formData.get('sku') as string) || '').trim() || null
  const category = (formData.get('category') as string) || null
  const description = (formData.get('description') as string) || null
  const costPrice = parseFloat(formData.get('costPrice') as string) || 0
  const salePrice = parseFloat(formData.get('salePrice') as string) || 0
  const stockQty = parseInt(formData.get('stockQty') as string) || 0
  const minStockAlert = parseInt(formData.get('minStockAlert') as string) || 0
  const ncm = (formData.get('ncm') as string) || null
  const cfop = (formData.get('cfop') as string) || null
  const gtin = lerGtin(formData)

  await prisma.product.update({
    where: { id },
    data: { name, sku, category, description, costPrice, salePrice, stockQty, minStockAlert, ncm, cfop, gtin }
  })

  redirect('/produtos')
}

export async function deleteProduct(id: string) {
  try {
    // Verifica se o produto está vinculado a vendas
    const saleItemsCount = await prisma.saleItem.count({ where: { productId: id } })
    if (saleItemsCount > 0) {
      return { error: `Este produto não pode ser excluído pois está vinculado a ${saleItemsCount} venda(s).` }
    }

    await prisma.product.delete({
      where: { id }
    })
    revalidatePath('/produtos')
    return { success: true }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    // Violação de chave estrangeira (Postgres P2003 / SQLite FOREIGN KEY)
    if (msg.includes('Foreign key constraint') || msg.includes('P2003') || msg.includes('FOREIGN KEY')) {
      return { error: 'Este produto não pode ser excluído pois está sendo usado em vendas ou orçamentos.' }
    }
    return { error: 'Erro ao excluir produto. Tente novamente.' }
  }
}
