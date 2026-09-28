'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export interface ImportTransactionPayload {
  description: string
  amount: number
  date: string
  type: 'RECEITA' | 'DESPESA'
  categoryId?: string
  notes?: string
}

export async function salvarTransacoesImportadas(transacoes: ImportTransactionPayload[]) {
  try {
    const data = transacoes.map(t => ({
      description: t.description,
      amount: Math.abs(t.amount), // Sempre salva valor absoluto
      type: t.type,
      dueDate: new Date(t.date),
      paidDate: new Date(t.date), // Como é do extrato, já foi pago
      status: 'PAGO',
      paymentMethod: 'Transferência/Bancário', // Genérico para extrato
      categoryId: t.categoryId || null,
      notes: t.notes ? `[Importado via OFX] ${t.notes}` : '[Importado via OFX]',
    }))

    await prisma.financeTransaction.createMany({
      data,
    })

    revalidatePath('/financeiro')
    revalidatePath('/relatorios')
    
    return { success: true, count: data.length }
  } catch (error: any) {
    console.error('Erro ao salvar transações importadas:', error)
    return { error: error.message || 'Erro ao importar as transações para o banco de dados.' }
  }
}

export async function buscarCategoriasFinanceiras() {
  return prisma.financeCategory.findMany({
    orderBy: { name: 'asc' }
  })
}
