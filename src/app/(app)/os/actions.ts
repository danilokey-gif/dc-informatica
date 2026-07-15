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

export async function updateOS(id: string, formData: FormData) {
  const customerId = formData.get('customerId') as string
  const device = formData.get('device') as string
  const issue = formData.get('issue') as string
  const technicalReport = formData.get('technicalReport') as string
  const price = formData.get('price') ? parseFloat(formData.get('price') as string) : null
  const status = formData.get('status') as string
  const technicianId = (formData.get('technicianId') as string) || null

  await prisma.serviceOrder.update({
    where: { id },
    data: { customerId, device, issue, technicalReport, price, status, technicianId }
  })

  redirect('/os')
}

export async function deleteOS(id: string) {
  await prisma.serviceOrder.delete({
    where: { id }
  })
  revalidatePath('/os')
}
