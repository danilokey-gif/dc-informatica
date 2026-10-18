'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import type { QuickCustomerData } from "@/components/QuickCustomerModal"

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

export async function createCustomerQuick(data: QuickCustomerData) {
  const customer = await prisma.customer.create({
    data: {
      name: data.name,
      document: data.document || null,
      phone: data.phone || null,
      enderCep: data.enderCep || null,
      enderLogradouro: data.enderLogradouro || null,
      enderNumero: data.enderNumero || null,
      enderBairro: data.enderBairro || null,
      enderMunicipio: data.enderMunicipio || null,
      enderUf: data.enderUf || null,
      enderCodMunicipio: data.enderCodMunicipio || null,
    }
  })
  return { id: customer.id, name: customer.name, document: customer.document }
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

  revalidatePath('/clientes')
  revalidatePath(`/clientes/${id}`)
  redirect('/clientes')
}

/**
 * Exclui o cliente só se ele não tiver histórico. Com OS, vendas, orçamentos, lançamentos ou
 * cobrança mensal, o banco não deixa apagar (e não deve: notas e financeiro dependem disso).
 */
export async function deleteCustomer(id: string): Promise<{ ok?: boolean; erro?: string }> {
  const c = await prisma.customer.findUnique({ where: { id }, include: { _count: true } })
  if (!c) return { ok: true }
  const n = c._count
  const historico = [
    n.serviceOrders && `${n.serviceOrders} OS`,
    n.sales && `${n.sales} venda(s)`,
    n.quotes && `${n.quotes} orçamento(s)`,
    n.transactions && `${n.transactions} lançamento(s) no Financeiro`,
    n.cobrancasMensais && 'cobrança mensal',
  ].filter(Boolean)
  if (historico.length) {
    return { erro: `Não dá para excluir "${c.name}": o cliente tem ${historico.join(', ')}. O histórico é necessário para as notas fiscais e o Financeiro.` }
  }
  await prisma.customer.delete({ where: { id } })
  revalidatePath('/clientes')
  return { ok: true }
}
