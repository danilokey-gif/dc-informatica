'use server'

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth"
import { lerExtratoCaixinha } from "@/lib/caixinha-nubank"

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

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const meioDia = (iso: string) => new Date(`${iso}T12:00:00Z`)

/**
 * Lê o PDF "Extrato de Rendimentos – Caixinhas PJ" do Nubank e atualiza a tela de investimentos:
 * saldo de cada fim de mês (com rendimento e IR), aplicações/resgates que ainda não estão no
 * Financeiro e, se for o primeiro extrato, o saldo que já existia antes do período.
 * Pode enviar o mesmo período de novo: o que já existe é atualizado, não duplicado.
 */
export async function importarExtratoCaixinha(formData: FormData): Promise<{ ok: boolean; mensagem: string }> {
  const user = await getCurrentUser()
  if (user?.role !== 'ADMIN') return { ok: false, mensagem: 'Só o administrador pode importar extratos.' }
  try {
    const arquivo = formData.get('arquivo')
    if (!(arquivo instanceof File) || arquivo.size === 0) return { ok: false, mensagem: 'Escolha o PDF do extrato da Caixinha.' }
    if (arquivo.size > 4 * 1024 * 1024) return { ok: false, mensagem: 'PDF grande demais (máximo 4 MB).' }

    const { extractText, getDocumentProxy } = await import('unpdf')
    const pdf = await getDocumentProxy(new Uint8Array(await arquivo.arrayBuffer()))
    const { text } = await extractText(pdf, { mergePages: true })
    const extrato = lerExtratoCaixinha(text)

    let criados = 0, atualizados = 0, movimentosNovos = 0

    // Saldo de antes do período: só quando não há nenhum saldo registrado antes do início.
    const temAnterior = await prisma.saldoInvestimento.findFirst({ where: { data: { lt: meioDia(extrato.inicio) } } })
    if (!temAnterior && extrato.saldoInicial > 0.01) {
      const vespera = new Date(meioDia(extrato.inicio).getTime() - 86400000)
      await prisma.financeTransaction.create({ data: {
        type: 'APLICACAO', description: `Saldo da Caixinha antes de ${vespera.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`,
        amount: extrato.saldoInicial, dueDate: vespera, paidDate: vespera, status: 'PAGO', paymentMethod: 'Caixinha Nubank',
        notes: `Saldo de abertura calculado pelo extrato da Caixinha (${extrato.inicio} a ${extrato.fim}).`,
      } })
      await prisma.saldoInvestimento.create({ data: { data: vespera, valor: extrato.saldoInicial, descricao: 'Caixinha RDB Nubank PJ — Saldo inicial' } })
      criados++
    }

    // Aplicações e resgates reais (renovações do RDB não movem dinheiro). Normalmente já vieram pelo
    // extrato da conta (OFX); só cria o que não existir com o mesmo valor em até 3 dias.
    for (const m of extrato.movimentos.filter(m => m.tipo === 'APLICACAO' || m.tipo === 'RESGATE')) {
      const d = meioDia(m.data)
      const existe = await prisma.financeTransaction.findFirst({ where: {
        type: m.tipo, status: { not: 'CANCELADO' }, amount: { gte: m.valor - 0.01, lte: m.valor + 0.01 },
        dueDate: { gte: new Date(d.getTime() - 3 * 86400000), lte: new Date(d.getTime() + 3 * 86400000) },
      } })
      if (existe) continue
      await prisma.financeTransaction.create({ data: {
        type: m.tipo, description: m.tipo === 'APLICACAO' ? 'Aplicação na Caixinha RDB' : 'Resgate da Caixinha RDB',
        amount: m.valor, dueDate: d, paidDate: d, status: 'PAGO', paymentMethod: 'Caixinha Nubank', notes: '[Extrato Caixinha PDF]',
      } })
      movimentosNovos++
    }

    // Saldo de cada fim de mês.
    for (const s of extrato.saldosMensais) {
      const descricao = `Caixinha RDB Nubank PJ — Rendeu ${brl(s.rendimento)}${s.imposto ? ` · IR/IOF retido ${brl(s.imposto)}` : ''}`
      const d = meioDia(s.data)
      const existente = await prisma.saldoInvestimento.findFirst({ where: { data: { gte: new Date(d.getTime() - 43200000), lte: new Date(d.getTime() + 43200000) } } })
      if (existente) {
        if (Math.abs(existente.valor - s.saldo) > 0.009 || existente.descricao !== descricao || existente.rendimentoBruto !== s.rendimento || existente.impostoRetido !== s.imposto) {
          await prisma.saldoInvestimento.update({ where: { id: existente.id }, data: { valor: s.saldo, descricao, rendimentoBruto: s.rendimento, impostoRetido: s.imposto } }); atualizados++
        }
      } else {
        await prisma.saldoInvestimento.create({ data: { data: d, valor: s.saldo, descricao, rendimentoBruto: s.rendimento, impostoRetido: s.imposto } }); criados++
      }
    }

    revalidatePath('/financeiro/investimentos')
    const rendimento = extrato.saldosMensais.reduce((t, s) => t + s.rendimento, 0)
    const imposto = extrato.movimentos.reduce((t, m) => t + m.imposto, 0)
    return { ok: true, mensagem:
      `Extrato de ${extrato.inicio.split('-').reverse().join('/')} a ${extrato.fim.split('-').reverse().join('/')}: saldo final ${brl(extrato.saldoFinal)}, ` +
      `rendimento bruto ${brl(rendimento)}${imposto ? `, IR/IOF ${brl(imposto)}` : ''}. ` +
      `${criados} saldo(s) novo(s), ${atualizados} atualizado(s)${movimentosNovos ? `, ${movimentosNovos} aplicação(ões)/resgate(s) lançado(s)` : ''}.` }
  } catch (e) {
    return { ok: false, mensagem: e instanceof Error ? e.message : String(e) }
  }
}
