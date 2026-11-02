import { NextRequest } from "next/server"
import { notasDoAno, resumoDoAno, MESES, type LinhaNota } from "../notas-do-ano"

export const dynamic = 'force-dynamic'

const num = (v: number) => v.toFixed(2).replace('.', ',')
const celula = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
const dataBr = (d: Date) => d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })

/**
 * Planilha (CSV no padrão do Excel brasileiro: ponto e vírgula, vírgula decimal) das notas do ano.
 * ?aba=servico|produto|devolucao filtra o tipo; sem aba vem o resumo mês a mês + todas as notas.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const ano = Number(searchParams.get('ano')) || new Date().getFullYear()
  const aba = searchParams.get('aba')
  const mes = Number(searchParams.get('mes')) || null

  const todas = (await notasDoAno(ano)).filter(l => l.grupo !== 'teste')
  const linhas: string[] = []

  if (!aba) {
    const r = resumoDoAno(todas)
    linhas.push(`Resumo das notas emitidas em ${ano} (somente autorizadas)`)
    linhas.push(['Mês', 'Serviço (NFS-e)', 'Qtd serviço', 'Produto (NF-e)', 'Qtd produto', 'Devoluções de venda', 'Total do mês'].join(';'))
    for (const m of r.meses) linhas.push([MESES[m.mes - 1], num(m.servico), m.qtdServico, num(m.produto), m.qtdProduto, num(m.devolucao), num(m.total)].join(';'))
    linhas.push([`Total ${ano}`, num(r.servico.valor), r.servico.qtd, num(r.produto.valor), r.produto.qtd, num(r.devolucaoVenda.valor), num(r.total)].join(';'))
    linhas.push('')
  }

  const lista: LinhaNota[] = todas
    .filter(l => !aba || l.grupo === aba)
    .filter(l => !mes || l.mes === mes)
    .sort((a, b) => a.data.getTime() - b.data.getTime())
  linhas.push(['Data', 'Tipo', 'Número', 'Série', 'Cliente / destinatário', 'CPF/CNPJ', 'Valor', 'Situação', 'Observação'].join(';'))
  for (const l of lista) {
    linhas.push([
      dataBr(l.data), l.finalidade.startsWith('DEVOLUCAO') ? 'Devolução NF-e' : l.tipoNota, l.numero, l.serie,
      celula(l.cliente), l.documento ?? '', num(l.valor), l.status, celula(l.observacao ?? ''),
    ].join(';'))
  }

  const nome = `notas-${ano}${aba ? `-${aba}` : ''}${mes ? `-${String(mes).padStart(2, '0')}` : ''}.csv`
  // BOM para o Excel abrir os acentos certos.
  return new Response('﻿' + linhas.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${nome}"`,
    },
  })
}
