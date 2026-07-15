'use server'

import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"

interface CartItem {
  productId: string
  quantity: number
}

export async function createSale(formData: FormData) {
  const customerId = (formData.get('customerId') as string) || null
  const paymentMethod = formData.get('paymentMethod') as string
  const itemsJson = formData.get('itemsJson') as string
  const items: CartItem[] = JSON.parse(itemsJson || '[]')

  if (items.length === 0) {
    throw new Error('Adicione ao menos um produto à venda.')
  }

  const sale = await prisma.$transaction(async (tx) => {
    let total = 0
    const saleItemsData = []

    for (const item of items) {
      const product = await tx.product.findUnique({ where: { id: item.productId } })
      if (!product) {
        throw new Error('Produto não encontrado.')
      }
      if (product.stockQty < item.quantity) {
        throw new Error(`Estoque insuficiente para "${product.name}". Disponível: ${product.stockQty}`)
      }

      await tx.product.update({
        where: { id: item.productId },
        data: { stockQty: { decrement: item.quantity } }
      })

      total += product.salePrice * item.quantity
      saleItemsData.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: product.salePrice
      })
    }

    const novaVenda = await tx.sale.create({
      data: {
        customerId: customerId || undefined,
        paymentMethod,
        total,
        items: { create: saleItemsData }
      }
    })

    // Venda no PDV é recebida na hora: já entra como receita paga no financeiro.
    await tx.financeTransaction.create({
      data: {
        type: 'RECEITA',
        description: `Venda #${novaVenda.id.slice(-6).toUpperCase()}`,
        amount: total,
        dueDate: novaVenda.createdAt,
        paidDate: novaVenda.createdAt,
        status: 'PAGO',
        paymentMethod,
        customerId: customerId || undefined,
        saleId: novaVenda.id,
      }
    })

    return novaVenda
  })

  redirect(`/vendas/${sale.id}/imprimir`)
}

export async function updateSaleInvoice(id: string, formData: FormData) {
  const invoiceType = (formData.get('invoiceType') as string) || null
  const invoiceNumber = (formData.get('invoiceNumber') as string) || null

  await prisma.sale.update({
    where: { id },
    data: { invoiceType, invoiceNumber }
  })

  redirect(`/vendas/${id}/imprimir`)
}
