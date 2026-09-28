'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createQuote(formData: FormData) {
  const customerId = formData.get('customerId') as string
  const validUntilStr = formData.get('validUntil') as string
  const notes = formData.get('notes') as string
  const itemsJson = formData.get('itemsJson') as string

  if (!itemsJson) throw new Error('Itens não informados')
  const items = JSON.parse(itemsJson) as { isService: boolean; productId?: string; name: string; quantity: number; unitPrice: number }[]

  const total = items.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0)

  let validUntil = null
  if (validUntilStr) {
    validUntil = new Date(validUntilStr)
  }

  const quote = await prisma.quote.create({
    data: {
      customerId: customerId || null,
      total,
      validUntil,
      notes,
      items: {
        create: items.map(i => ({
          name: i.name,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          isService: i.isService,
          productId: i.productId || null,
        }))
      }
    }
  })

  revalidatePath('/orcamentos')
  redirect('/orcamentos')
}
