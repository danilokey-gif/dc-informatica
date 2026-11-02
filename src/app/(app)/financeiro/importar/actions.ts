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

const dia = (d: Date) => d.toISOString().slice(0, 10)

export async function salvarTransacoesImportadas(transacoes: ImportTransactionPayload[]) {
  try {
    // Não importa de novo o que já veio de outro extrato: mesmo identificador do banco (FITID, guardado
    // nas observações) ou mesma data + valor + descrição + tipo. Extratos de períodos que se sobrepõem
    // (ex.: um até 01/08 e outro a partir de 01/08) não duplicam lançamentos.
    const datas = transacoes.map(t => new Date(t.date).getTime())
    const existentes = transacoes.length === 0 ? [] : await prisma.financeTransaction.findMany({
      where: {
        paymentMethod: 'Transferência/Bancário',
        dueDate: { gte: new Date(Math.min(...datas) - 2 * 86400000), lte: new Date(Math.max(...datas) + 2 * 86400000) },
      },
      select: { description: true, amount: true, type: true, dueDate: true, notes: true },
    })
    const chave = (d: Date, valor: number, descricao: string, tipo: string) => `${dia(d)}|${Math.abs(valor).toFixed(2)}|${descricao.trim()}|${tipo}`
    const jaTem = new Set(existentes.map(e => chave(e.dueDate, e.amount, e.description, e.type)))
    const idsBanco = new Set(existentes.flatMap(e => (e.notes || '').match(/\[Importado via OFX\] (\S+)/)?.[1] ?? []))
    const novas = transacoes.filter(t => {
      const k = chave(new Date(t.date), t.amount, t.description, t.type)
      if (jaTem.has(k) || (t.notes && idsBanco.has(t.notes))) return false
      jaTem.add(k)
      return true
    })
    const repetidas = transacoes.length - novas.length

    const data = novas.map(t => ({
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
    
    return { success: true, count: data.length, repetidas }
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
