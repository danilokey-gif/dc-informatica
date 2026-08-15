'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function createInvoice(formData: FormData) {
  const serviceOrderId = formData.get('serviceOrderId') as string
  const customerId = formData.get('customerId') as string
  const totalAmount = parseFloat(formData.get('totalAmount') as string)

  const invoiceNumber = `NFe-${Date.now()}`
  const nfeKey = `${Date.now()}${Math.random().toString().slice(2, 10)}`

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      serviceOrderId,
      customerId,
      totalAmount,
      nfeKey,
      status: 'ISSUED',
      nfeUrl: `/api/nfe/${invoiceNumber}/download`
    }
  })

  redirect(`/nfe/${invoice.id}`)
}

export async function deleteInvoice(id: string) {
  await prisma.invoice.delete({
    where: { id }
  })
  revalidatePath('/nfe')
}

export async function cancelInvoice(id: string) {
  await prisma.invoice.update({
    where: { id },
    data: { status: 'CANCELLED' }
  })
  revalidatePath('/nfe')
}
