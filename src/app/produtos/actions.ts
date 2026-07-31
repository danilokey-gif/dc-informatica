'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function createProduct(formData: FormData) {
  const name = formData.get('name') as string
  const description = formData.get('description') as string
  const price = parseFloat(formData.get('price') as string)
  const quantity = parseInt(formData.get('quantity') as string) || 0
  const sku = formData.get('sku') as string

  await prisma.product.create({
    data: { name, description, price, quantity, sku: sku || undefined }
  })

  redirect('/produtos')
}

export async function updateProduct(id: string, formData: FormData) {
  const name = formData.get('name') as string
  const description = formData.get('description') as string
  const price = parseFloat(formData.get('price') as string)
  const quantity = parseInt(formData.get('quantity') as string) || 0
  const sku = formData.get('sku') as string

  await prisma.product.update({
    where: { id },
    data: { name, description, price, quantity, sku: sku || undefined }
  })

  redirect('/produtos')
}

export async function deleteProduct(id: string) {
  await prisma.product.delete({
    where: { id }
  })
  revalidatePath('/produtos')
}
