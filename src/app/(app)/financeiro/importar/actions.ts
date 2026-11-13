'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { classificarExtrato } from "@/lib/financeiro-tipos"
import { pagadorConfere, acharLancamentoJaPago } from "@/lib/conciliacao"
import { categoriaSugerida } from "@/lib/financeiro-categorias"

export interface ImportTransactionPayload {
  description: string
  amount: number
  date: string
  type: 'RECEITA' | 'DESPESA'
  categoryId?: string
  notes?: string
}

const DIA = 86400000
const dia = (d: Date) => d.toISOString().slice(0, 10)
const marcaOfx = (fitid?: string) => (fitid ? `[Importado via OFX] ${fitid}` : '[Importado via OFX]')

/**
 * Importa o extrato OFX conciliando com o que já está no Financeiro:
 * 1. Repetido (mesmo FITID, ou mesma data + valor + descrição) → pula.
 * 2. Conta A RECEBER/A PAGAR do mesmo valor e do mesmo cliente (parcela, nota, venda) → dá baixa
 *    nela na data do banco, em vez de criar outro lançamento.
 * 3. Lançamento JÁ PAGO feito pelo sistema (venda, OS, compra) com o mesmo valor, perto da data e do
 *    mesmo cliente → só marca como confirmado pelo banco.
 * 4. O resto entra como lançamento novo. Aplicação/resgate e Pix do/para o sócio não são
 *    receita nem despesa (ver classificarExtrato).
 */
export async function salvarTransacoesImportadas(transacoes: ImportTransactionPayload[]) {
  try {
    if (transacoes.length === 0) return { success: true, count: 0, repetidas: 0, baixas: 0, confirmadas: 0 }
    const datas = transacoes.map(t => new Date(t.date).getTime())
    const de = new Date(Math.min(...datas) - 60 * DIA), ate = new Date(Math.max(...datas) + 60 * DIA)

    const candidatos = await prisma.financeTransaction.findMany({
      where: { status: { not: 'CANCELADO' }, dueDate: { gte: de, lte: ate } },
      select: {
        id: true, description: true, amount: true, type: true, status: true, dueDate: true, paidDate: true, notes: true, paymentMethod: true,
        customer: { select: { name: true, document: true } }, supplier: { select: { name: true, document: true } },
      },
    })
    // Documento do cliente das receitas de NFS-e (a receita guarda a chave da nota nas observações).
    const chaves = candidatos.flatMap(c => (c.notes || '').match(/(\d{50})/)?.[1] ?? [])
    const notas = chaves.length ? await prisma.nfseEmissao.findMany({ where: { chaveAcesso: { in: chaves } }, select: { chaveAcesso: true, tomadorDocumento: true, tomadorNome: true } }) : []
    const notaPorChave = new Map(notas.map(n => [n.chaveAcesso!, n]))
    const pessoa = (c: typeof candidatos[number]) => {
      const nota = notaPorChave.get((c.notes || '').match(/(\d{50})/)?.[1] ?? '')
      return {
        documento: c.customer?.document || c.supplier?.document || nota?.tomadorDocumento || null,
        nome: c.customer?.name || c.supplier?.name || nota?.tomadorNome || c.description.split('—').pop() || '',
      }
    }

    // FITIDs e assinaturas já importados (em qualquer lançamento, inclusive vendas/OS conciliadas).
    const fitids = new Set(candidatos.flatMap(c => [...(c.notes || '').matchAll(/\[Importado via OFX\] (\S+)/g)].map(m => m[1])))
    const outrosFitids = await prisma.financeTransaction.findMany({
      where: { notes: { in: transacoes.flatMap(t => (t.notes ? [`[Importado via OFX] ${t.notes}`] : [])) } }, select: { notes: true },
    })
    outrosFitids.forEach(o => fitids.add((o.notes || '').replace('[Importado via OFX] ', '')))
    const chave = (d: Date, valor: number, descricao: string, tipo: string) => `${dia(d)}|${Math.abs(valor).toFixed(2)}|${descricao.trim()}|${tipo}`
    const jaTem = new Set(candidatos.filter(c => c.paymentMethod === 'Transferência/Bancário').map(c => chave(c.dueDate, c.amount, c.description, c.type)))
    const usados = new Set<string>()
    const categorias = new Map((await prisma.financeCategory.findMany({ select: { id: true, name: true } })).map(c => [c.name, c.id]))

    let repetidas = 0, baixas = 0, confirmadas = 0
    const novas: ReturnType<typeof montar>[] = []
    function montar(t: Omit<ImportTransactionPayload, 'type'> & { type: string }) {
      return {
        description: t.description, amount: Math.abs(t.amount), type: t.type,
        dueDate: new Date(t.date), paidDate: new Date(t.date), status: 'PAGO',
        paymentMethod: 'Transferência/Bancário',
        // Sem categoria escolhida na tela: usa a sugerida pela descrição (impostos, compras, cartão...).
        categoryId: t.categoryId || categorias.get(categoriaSugerida({ type: t.type, description: t.description }) ?? '') || null,
        notes: marcaOfx(t.notes),
      }
    }

    for (const bruto of transacoes) {
      const t = { ...bruto, type: classificarExtrato(bruto.description, bruto.type === 'RECEITA' ? 1 : -1) }
      const data = new Date(t.date), valor = Math.abs(t.amount)
      const k = chave(data, valor, t.description, t.type)
      if ((t.notes && fitids.has(t.notes)) || jaTem.has(k)) { repetidas++; continue }
      jaTem.add(k)
      if (t.notes) fitids.add(t.notes)

      const mesmoValor = candidatos.filter(c => !usados.has(c.id) && c.type === t.type && Math.abs(c.amount - valor) < 0.01 && !/\[Importado via OFX\]/.test(c.notes || ''))
      const dias = (c: { dueDate: Date }) => (data.getTime() - c.dueDate.getTime()) / DIA
      const confere = (c: typeof candidatos[number]) => {
        const p = pessoa(c)
        // Despesa: o banco mostra o intermediário (ex.: "PIX Marketplace"), então basta valor e data.
        return t.type === 'DESPESA' || t.type === 'APLICACAO' || t.type === 'RESGATE' || pagadorConfere(t.description, p.documento, p.nome)
      }

      // 2. Baixa em conta a receber/a pagar.
      const pendente = mesmoValor.filter(c => c.status === 'PENDENTE' && dias(c) >= -45 && dias(c) <= 45 && confere(c))
        .sort((a, b) => Math.abs(dias(a)) - Math.abs(dias(b)))[0]
      if (pendente) {
        usados.add(pendente.id)
        await prisma.financeTransaction.update({ where: { id: pendente.id }, data: {
          status: 'PAGO', paidDate: data, notes: `${pendente.notes ? pendente.notes + ' | ' : ''}${marcaOfx(t.notes)} — pago no banco em ${data.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`,
        } })
        baixas++
        continue
      }
      // 3. Já lançado e pago pelo sistema (venda, OS, compra, aplicação).
      const jaPago = acharLancamentoJaPago(mesmoValor, data, confere)
      if (jaPago) {
        usados.add(jaPago.id)
        await prisma.financeTransaction.update({ where: { id: jaPago.id }, data: {
          notes: `${jaPago.notes ? jaPago.notes + ' | ' : ''}${marcaOfx(t.notes)} — confirmado no banco em ${data.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`,
        } })
        confirmadas++
        continue
      }
      novas.push(montar(t))
    }

    if (novas.length) await prisma.financeTransaction.createMany({ data: novas })

    revalidatePath('/financeiro')
    revalidatePath('/relatorios')
    return { success: true, count: novas.length, repetidas, baixas, confirmadas }
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
