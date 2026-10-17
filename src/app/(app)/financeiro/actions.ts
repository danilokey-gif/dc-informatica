'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { dividirEmParcelas } from "@/lib/dates"

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

/**
 * Baixa de pagamento com data e forma escolhidas (o pagamento do boleto pode ter sido ontem ou
 * na semana passada). A data vem do campo do formulário (AAAA-MM-DD) e é gravada ao meio-dia UTC,
 * para não mudar de dia por causa do fuso.
 */
export async function registrarPagamento(id: string, formData: FormData) {
  const dia = (formData.get('paidDate') as string) || new Date().toISOString().slice(0, 10)
  const paymentMethod = (formData.get('paymentMethod') as string) || undefined
  await prisma.financeTransaction.update({
    where: { id },
    data: { status: 'PAGO', paidDate: new Date(`${dia}T12:00:00.000Z`), ...(paymentMethod ? { paymentMethod } : {}) },
  })
  revalidatePath('/financeiro')
  revalidatePath('/financeiro/contas')
  revalidatePath(`/financeiro/contas/${id}`)
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
export async function gerarContaReceberOS(serviceOrderId: string, formData?: FormData) {
  const parcelas = formData ? parseInt(formData.get('parcelas') as string) || 1 : 1
  const paymentMethod = formData ? (formData.get('paymentMethod') as string) : 'Dinheiro'
  const jaPago = formData ? formData.get('jaPago') === '1' : false

  const os = await prisma.serviceOrder.findUniqueOrThrow({
    where: { id: serviceOrderId },
    include: { customer: true }
  })

  if (!os.price) {
    throw new Error('A OS não tem valor definido.')
  }

  const valores = dividirEmParcelas(os.price, parcelas)

  for (let i = 0; i < parcelas; i++) {
    const dataVencimento = new Date()
    if (i > 0) {
      dataVencimento.setDate(dataVencimento.getDate() + (30 * i))
    }

    const parcelaPaga = i === 0 ? jaPago : false
    const descParcela = parcelas > 1 
      ? `OS #${os.id.slice(-6).toUpperCase()} - ${os.device} (Parc. ${i + 1}/${parcelas})`
      : `OS #${os.id.slice(-6).toUpperCase()} - ${os.device}`
    const finalPaymentMethod = parcelas > 1 ? `${paymentMethod} (${parcelas}x)` : paymentMethod

    await prisma.financeTransaction.create({
      data: {
        type: 'RECEITA',
        description: descParcela,
        amount: valores[i],
        dueDate: dataVencimento,
        paidDate: parcelaPaga ? new Date() : null,
        customerId: os.customerId,
        serviceOrderId: os.id,
        status: parcelaPaga ? 'PAGO' : 'PENDENTE',
        paymentMethod: finalPaymentMethod,
      }
    })
  }

  revalidatePath(`/os/${serviceOrderId}/imprimir`)
  revalidatePath('/financeiro')
}
