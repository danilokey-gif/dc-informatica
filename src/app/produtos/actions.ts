'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function createProduct(formData: FormData) {
  const name = formData.get('name') as string
  const sku = (formData.get('sku') as string) || null
  const category = (formData.get('category') as string) || null
  const description = (formData.get('description') as string) || null
  const costPrice = parseFloat(formData.get('costPrice') as string) || 0
  const salePrice = parseFloat(formData.get('salePrice') as string) || 0
  const stockQty = parseInt(formData.get('stockQty') as string) || 0
  const minStockAlert = parseInt(formData.get('minStockAlert') as string) || 0

  await prisma.product.create({
    data: { name, sku, category, description, costPrice, salePrice, stockQty, minStockAlert }
  })

  redirect('/produtos')
}

export async function updateProduct(id: string, formData: FormData) {
  const name = formData.get('name') as string
  const sku = (formData.get('sku') as string) || null
  const category = (formData.get('category') as string) || null
  const description = (formData.get('description') as string) || null
  const costPrice = parseFloat(formData.get('costPrice') as string) || 0
  const salePrice = parseFloat(formData.get('salePrice') as string) || 0
  const stockQty = parseInt(formData.get('stockQty') as string) || 0
  const minStockAlert = parseInt(formData.get('minStockAlert') as string) || 0

  await prisma.product.update({
    where: { id },
    data: { name, sku, category, description, costPrice, salePrice, stockQty, minStockAlert }
  })

  redirect('/produtos')
}

export async function deleteProduct(id: string) {
  await prisma.product.delete({
    where: { id }
  })
  revalidatePath('/produtos')
}
