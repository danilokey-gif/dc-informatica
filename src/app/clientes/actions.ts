'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function createCustomer(formData: FormData) {
  const name = formData.get('name') as string
  const document = formData.get('document') as string
  const phone = formData.get('phone') as string
  const address = formData.get('address') as string
  const email = formData.get('email') as string

  await prisma.customer.create({
    data: { name, document, phone, address, email }
  })

  redirect('/clientes')
}

export async function updateCustomer(id: string, formData: FormData) {
  const name = formData.get('name') as string
  const document = formData.get('document') as string
  const phone = formData.get('phone') as string
  const address = formData.get('address') as string
  const email = formData.get('email') as string

  await prisma.customer.update({
    where: { id },
    data: { name, document, phone, address, email }
  })

  redirect('/clientes')
}

export async function deleteCustomer(id: string) {
  await prisma.customer.delete({
    where: { id }
  })
  revalidatePath('/clientes')
}
