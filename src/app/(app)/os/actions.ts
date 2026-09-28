'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function createOS(formData: FormData) {
  const customerId = formData.get('customerId') as string
  const device = formData.get('device') as string
  const issue = formData.get('issue') as string
  const status = formData.get('status') as string || 'BUDGET'
  const technicianId = (formData.get('technicianId') as string) || null

  await prisma.serviceOrder.create({
    data: { customerId, device, issue, status, technicianId }
  })

  redirect('/os')
}

export async function createOSRapida(formData: FormData) {
  const customerId = formData.get('customerId') as string
  const descricao = formData.get('descricao') as string
  const precoRaw = formData.get('price') as string
  const price = precoRaw ? parseFloat(precoRaw) : null

  const os = await prisma.serviceOrder.create({
    data: { customerId, device: '', issue: descricao, price, status: 'COMPLETED' }
  })

  redirect(`/os/${os.id}/imprimir`)
}

export async function updateOS(id: string, formData: FormData) {
  const customerId = formData.get('customerId') as string
  const device = formData.get('device') as string
  const issue = formData.get('issue') as string
  const technicalReport = formData.get('technicalReport') as string
  const price = formData.get('price') ? parseFloat(formData.get('price') as string) : null
  const status = formData.get('status') as string
  const technicianId = (formData.get('technicianId') as string) || null

  const oldOs = await prisma.serviceOrder.findUnique({
    where: { id },
    include: { transactions: true, customer: true }
  })

  await prisma.serviceOrder.update({
    where: { id },
    data: { customerId, device, issue, technicalReport, price, status, technicianId }
  })

  if (status === 'DELIVERED') {
    const paymentMethod = (formData.get('paymentMethod') as string) || 'Dinheiro'
    const clienteNome = oldOs?.customer?.name || ''
    const descricao = clienteNome
      ? `OS - ${device} — ${clienteNome}`
      : `OS #${id.slice(-6).toUpperCase()} - ${device}`

    if (oldOs?.transactions && oldOs.transactions.length > 0) {
      // Tinha parcelas pendentes: dá baixa em todas
      await prisma.financeTransaction.updateMany({
        where: { serviceOrderId: id, status: 'PENDENTE' },
        data: { status: 'PAGO', paidDate: new Date() }
      })
    } else if (price) {
      // Não tinha nenhum lançamento: cria um novo já pago
      await prisma.financeTransaction.create({
        data: {
          type: 'RECEITA',
          description: descricao,
          amount: price,
          dueDate: new Date(),
          paidDate: new Date(),
          customerId,
          serviceOrderId: id,
          status: 'PAGO',
          paymentMethod,
        }
      })
    }
  }

  redirect('/os')
}

export async function deleteOS(id: string) {
  await prisma.serviceOrder.delete({
    where: { id }
  })
  revalidatePath('/os')
}
