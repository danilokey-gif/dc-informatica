'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

function enderecoFields(formData: FormData) {
  return {
    enderLogradouro: (formData.get('enderLogradouro') as string) || null,
    enderNumero: (formData.get('enderNumero') as string) || null,
    enderBairro: (formData.get('enderBairro') as string) || null,
    enderCep: (formData.get('enderCep') as string) || null,
    enderMunicipio: (formData.get('enderMunicipio') as string) || null,
    enderUf: (formData.get('enderUf') as string) || null,
    enderCodMunicipio: (formData.get('enderCodMunicipio') as string) || null,
  }
}

export async function createCustomer(formData: FormData) {
  const name = formData.get('name') as string
  const document = formData.get('document') as string
  const phone = formData.get('phone') as string
  const address = formData.get('address') as string
  const email = formData.get('email') as string

  await prisma.customer.create({
    data: { name, document, phone, address, email, ...enderecoFields(formData) }
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
    data: { name, document, phone, address, email, ...enderecoFields(formData) }
  })

  redirect('/clientes')
}

export async function deleteCustomer(id: string) {
  await prisma.customer.delete({
    where: { id }
  })
  revalidatePath('/clientes')
}
