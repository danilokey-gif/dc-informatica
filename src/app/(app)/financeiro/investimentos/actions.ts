'use server'

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"

/** Registra o saldo do investimento visto no app do banco (ex.: RDB do Nubank) numa data. */
export async function salvarSaldoInvestimento(formData: FormData) {
  const valor = Number(formData.get('valor'))
  const data = String(formData.get('data') || '')
  if (!Number.isFinite(valor) || valor < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return
  await prisma.saldoInvestimento.create({
    data: { valor: Math.round(valor * 100) / 100, data: new Date(`${data}T12:00:00Z`), descricao: String(formData.get('descricao') || '') || null },
  })
  revalidatePath('/financeiro/investimentos')
}

export async function excluirSaldoInvestimento(id: string) {
  await prisma.saldoInvestimento.delete({ where: { id } })
  revalidatePath('/financeiro/investimentos')
}
