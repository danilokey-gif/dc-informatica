'use server'

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { gerarContaReceberOS } from "./financeiro/actions"

function atualizarTelas(extra: string[]) {
  for (const p of ['/', '/notas-fiscais/emitir', '/financeiro', ...extra]) revalidatePath(p)
}

/**
 * Finaliza a OS sem nota fiscal: grava a forma de pagamento (gera a conta a receber, se ainda não
 * existir), marca a OS como concluída e tira ela da lista "Notas a emitir".
 */
export async function finalizarOsSemNota(serviceOrderId: string, formData: FormData) {
  const os = await prisma.serviceOrder.findUniqueOrThrow({ where: { id: serviceOrderId }, include: { transactions: { select: { type: true } } } })
  if (os.price && os.price > 0 && !os.transactions.some(t => t.type === 'RECEITA')) {
    await gerarContaReceberOS(serviceOrderId, formData)
  }
  await prisma.serviceOrder.update({
    where: { id: serviceOrderId },
    data: { semNotaFiscal: true, status: os.status === 'DELIVERED' ? 'DELIVERED' : 'COMPLETED' },
  })
  atualizarTelas([`/os/${serviceOrderId}`, `/os/${serviceOrderId}/imprimir`, '/os'])
}

/** Volta a OS para "nota a emitir" (o usuário decidiu emitir a nota). */
export async function desfazerOsSemNota(serviceOrderId: string) {
  await prisma.serviceOrder.update({ where: { id: serviceOrderId }, data: { semNotaFiscal: false } })
  atualizarTelas([`/os/${serviceOrderId}`, `/os/${serviceOrderId}/imprimir`, '/os'])
}

/** Marca (ou desmarca) a venda como finalizada sem nota fiscal. */
export async function marcarVendaSemNota(saleId: string, semNota: boolean) {
  await prisma.sale.update({ where: { id: saleId }, data: { semNotaFiscal: semNota } })
  atualizarTelas([`/vendas/${saleId}/imprimir`, '/vendas'])
}
