'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { processarCobranca } from "@/lib/cobranca-mensal"

const CAMINHO = '/financeiro/cobrancas-mensais'

function voltarCom(chave: 'msg' | 'erro', texto: string): never {
  redirect(`${CAMINHO}?${chave}=${encodeURIComponent(texto)}`)
}

export async function salvarCobranca(formData: FormData) {
  const id = (formData.get('id') as string) || null
  const customerId = (formData.get('customerId') as string) || ''
  const descricao = ((formData.get('descricao') as string) || '').trim()
  const valor = parseFloat(((formData.get('valor') as string) || '').replace(',', '.'))
  const diaDoMes = parseInt(formData.get('diaDoMes') as string, 10)
  const codigoServico = ((formData.get('codigoServico') as string) || '').replace(/\D/g, '')
  const descricaoCodServico = ((formData.get('descricaoCodServico') as string) || '').trim() || null
  const diasParaVencimento = parseInt(formData.get('diasParaVencimento') as string, 10)

  if (!customerId) voltarCom('erro', 'Escolha o cliente.')
  if (!descricao) voltarCom('erro', 'Informe a descrição do serviço.')
  if (!(valor > 0)) voltarCom('erro', 'Informe um valor maior que zero.')
  // Até 28: todo mês tem esse dia, então a nota nunca "pula" fevereiro.
  if (!(diaDoMes >= 1 && diaDoMes <= 28)) voltarCom('erro', 'O dia do mês precisa ser de 1 a 28.')
  if (codigoServico.length !== 6) voltarCom('erro', 'O código de serviço precisa ter 6 dígitos (ex.: 140101).')
  if (!(diasParaVencimento >= 0 && diasParaVencimento <= 60)) voltarCom('erro', 'O prazo de vencimento precisa ser de 0 a 60 dias.')

  const dados = {
    customerId,
    descricao,
    valor,
    diaDoMes,
    codigoServico,
    descricaoCodServico,
    diasParaVencimento,
    ativa: formData.get('ativa') === 'on',
    enviarEmail: formData.get('enviarEmail') === 'on',
    incluirPix: formData.get('incluirPix') === 'on',
  }
  if (id) await prisma.cobrancaMensal.update({ where: { id }, data: dados })
  else await prisma.cobrancaMensal.create({ data: dados })

  revalidatePath(CAMINHO)
  voltarCom('msg', 'Cobrança salva.')
}

export async function alternarCobranca(id: string) {
  const c = await prisma.cobrancaMensal.findUnique({ where: { id }, select: { ativa: true } })
  if (!c) voltarCom('erro', 'Cobrança não encontrada.')
  await prisma.cobrancaMensal.update({ where: { id }, data: { ativa: !c.ativa } })
  revalidatePath(CAMINHO)
  voltarCom('msg', c.ativa ? 'Cobrança desligada: não sai mais nota sozinha.' : 'Cobrança ligada: a nota sai sozinha no dia marcado.')
}

/** Emite já a nota deste mês (se ainda não saiu), sem esperar o dia marcado. */
export async function emitirCobrancaAgora(id: string) {
  const r = await processarCobranca(id, { manual: true })
  revalidatePath(CAMINHO)
  voltarCom(r.status === 'erro' ? 'erro' : 'msg', r.detalhe)
}

/**
 * Libera a competência atual para uma nova tentativa. Só deve ser usado depois de conferir que a
 * nota do mês NÃO foi emitida — por isso a tela pede confirmação.
 */
export async function liberarCompetencia(id: string) {
  await prisma.cobrancaMensal.update({ where: { id }, data: { ultimaCompetencia: null, ultimoResultado: 'Mês liberado para nova tentativa.' } })
  revalidatePath(CAMINHO)
  voltarCom('msg', 'Mês liberado. Use "Emitir agora" ou espere a rotina diária.')
}

export async function excluirCobranca(id: string) {
  await prisma.cobrancaMensal.delete({ where: { id } })
  revalidatePath(CAMINHO)
  voltarCom('msg', 'Cobrança excluída. As notas já emitidas continuam no sistema.')
}
