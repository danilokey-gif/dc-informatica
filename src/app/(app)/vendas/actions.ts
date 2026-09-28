'use server'

import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"

interface CartItem {
  productId: string
  quantity: number
}

export async function createSale(formData: FormData) {
  const customerId = (formData.get('customerId') as string) || null
  const paymentMethod = formData.get('paymentMethod') as string
  const parcelas = parseInt(formData.get('parcelas') as string) || 1
  const jaPago = formData.get('jaPago') === '1'
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
        paymentMethod: parcelas > 1 ? `${paymentMethod} (${parcelas}x)` : paymentMethod,
        total,
        items: { create: saleItemsData }
      }
    })

    const valorParcela = total / parcelas

    for (let i = 0; i < parcelas; i++) {
      const dataVencimento = new Date(novaVenda.createdAt)
      if (i > 0) {
        dataVencimento.setDate(dataVencimento.getDate() + (30 * i))
      }

      // A primeira parcela pode ser recebida no ato, as demais são pendentes
      const parcelaPaga = i === 0 ? jaPago : false
      
      const descParcela = parcelas > 1 
        ? `Venda #${novaVenda.id.slice(-6).toUpperCase()} (Parc. ${i + 1}/${parcelas})`
        : `Venda #${novaVenda.id.slice(-6).toUpperCase()}`

      await tx.financeTransaction.create({
        data: {
          type: 'RECEITA',
          description: descParcela,
          amount: valorParcela,
          dueDate: dataVencimento,
          paidDate: parcelaPaga ? novaVenda.createdAt : null,
          status: parcelaPaga ? 'PAGO' : 'PENDENTE',
          paymentMethod,
          customerId: customerId || undefined,
          saleId: novaVenda.id,
        }
      })
    }

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

export async function deleteSale(id: string) {
  const sale = await prisma.sale.findUnique({
    where: { id },
    include: { items: true, nfeEmissoes: true }
  })

  if (!sale) throw new Error('Venda não encontrada.')

  // Se houver NFe autorizada que não foi cancelada, não podemos excluir simplesmente.
  const nfeAutorizada = sale.nfeEmissoes.find(e => e.status === 'AUTORIZADA')
  if (nfeAutorizada) {
    throw new Error('Esta venda possui uma NF-e autorizada. Cancele a NF-e primeiro antes de excluir a venda.')
  }

  await prisma.$transaction(async (tx) => {
    // 1. Restaurar estoque
    for (const item of sale.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stockQty: { increment: item.quantity } }
      })
    }

    // 2. Excluir lançamentos financeiros associados
    await tx.financeTransaction.deleteMany({
      where: { saleId: id }
    })

    // 3. Excluir tentativas de emissões NFe
    await tx.nfeEmissao.deleteMany({
      where: { saleId: id }
    })

    // 4. Excluir os itens e a própria venda (cascade costuma cuidar dos itens, mas podemos garantir)
    await tx.saleItem.deleteMany({
      where: { saleId: id }
    })
    
    await tx.sale.delete({
      where: { id }
    })
  })

  revalidatePath('/vendas')
}
