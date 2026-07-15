'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function createSupplier(formData: FormData) {
  const name = formData.get('name') as string
  const document = formData.get('document') as string
  const phone = formData.get('phone') as string
  const address = formData.get('address') as string
  const email = formData.get('email') as string

  await prisma.supplier.create({
    data: { name, document, phone, address, email }
  })

  redirect('/fornecedores')
}

export async function updateSupplier(id: string, formData: FormData) {
  const name = formData.get('name') as string
  const document = formData.get('document') as string
  const phone = formData.get('phone') as string
  const address = formData.get('address') as string
  const email = formData.get('email') as string

  await prisma.supplier.update({
    where: { id },
    data: { name, document, phone, address, email }
  })

  redirect('/fornecedores')
}

export async function deleteSupplier(id: string) {
  await prisma.supplier.delete({
    where: { id }
  })
  revalidatePath('/fornecedores')
}
