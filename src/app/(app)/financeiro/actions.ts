'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function createTransaction(formData: FormData) {
  const type = formData.get('type') as string
  const description = formData.get('description') as string
  const amount = parseFloat(formData.get('amount') as string)
  const dueDate = new Date(formData.get('dueDate') as string)
  const categoryId = (formData.get('categoryId') as string) || null
  const supplierId = (formData.get('supplierId') as string) || null
  const customerId = (formData.get('customerId') as string) || null
  const paymentMethod = (formData.get('paymentMethod') as string) || null
  const notes = (formData.get('notes') as string) || null
  const jaPago = formData.get('jaPago') === '1'

  await prisma.financeTransaction.create({
    data: {
      type,
      description,
      amount,
      dueDate,
      categoryId,
      supplierId,
      customerId,
      paymentMethod,
      notes,
      status: jaPago ? 'PAGO' : 'PENDENTE',
      paidDate: jaPago ? new Date() : null,
    }
  })

  redirect('/financeiro/contas')
}

export async function updateTransaction(id: string, formData: FormData) {
  const description = formData.get('description') as string
  const amount = parseFloat(formData.get('amount') as string)
  const dueDate = new Date(formData.get('dueDate') as string)
  const categoryId = (formData.get('categoryId') as string) || null
  const supplierId = (formData.get('supplierId') as string) || null
  const customerId = (formData.get('customerId') as string) || null
  const paymentMethod = (formData.get('paymentMethod') as string) || null
  const notes = (formData.get('notes') as string) || null

  await prisma.financeTransaction.update({
    where: { id },
    data: { description, amount, dueDate, categoryId, supplierId, customerId, paymentMethod, notes }
  })

  redirect('/financeiro/contas')
}

export async function marcarComoPago(id: string) {
  await prisma.financeTransaction.update({
    where: { id },
    data: { status: 'PAGO', paidDate: new Date() }
  })
  revalidatePath('/financeiro')
  revalidatePath('/financeiro/contas')
}

export async function marcarComoPendente(id: string) {
  await prisma.financeTransaction.update({
    where: { id },
    data: { status: 'PENDENTE', paidDate: null }
  })
  revalidatePath('/financeiro')
  revalidatePath('/financeiro/contas')
}

export async function deleteTransaction(id: string) {
  await prisma.financeTransaction.delete({ where: { id } })
  revalidatePath('/financeiro')
  revalidatePath('/financeiro/contas')
}

export async function createCategory(formData: FormData) {
  const name = formData.get('name') as string
  const type = formData.get('type') as string

  await prisma.financeCategory.create({ data: { name, type } })
  revalidatePath('/financeiro/categorias')
  redirect('/financeiro/categorias')
}

export async function deleteCategory(id: string) {
  await prisma.financeCategory.delete({ where: { id } })
  revalidatePath('/financeiro/categorias')
}

/** Gera uma conta a receber a partir de uma OS com preço definido. */
export async function gerarContaReceberOS(serviceOrderId: string) {
  const os = await prisma.serviceOrder.findUniqueOrThrow({
    where: { id: serviceOrderId },
    include: { customer: true }
  })

  if (!os.price) {
    throw new Error('A OS não tem valor definido.')
  }

  await prisma.financeTransaction.create({
    data: {
      type: 'RECEITA',
      description: `OS #${os.id.slice(-6).toUpperCase()} - ${os.device}`,
      amount: os.price,
      dueDate: new Date(),
      customerId: os.customerId,
      serviceOrderId: os.id,
      status: 'PENDENTE',
    }
  })

  revalidatePath(`/os/${serviceOrderId}/imprimir`)
  revalidatePath('/financeiro')
}
