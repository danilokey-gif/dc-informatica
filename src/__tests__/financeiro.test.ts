import { describe, it, expect } from 'vitest'
import { pagadorConfere } from '@/lib/conciliacao'
import { categoriaSugerida, CATEGORIAS_PADRAO } from '@/lib/financeiro-categorias'
import { classificarExtrato, rotuloTipo } from '@/lib/financeiro-tipos'
import { origemReceita } from '@/lib/financeiro-nota'
import { parseOfx } from '@/lib/ofx-parser'
import { dividirEmParcelas, formatarDataUTC } from '@/lib/dates'
import { resumoMei, limiteMei } from '@/lib/limite-mei'
import { gtinValido } from '@/lib/gtin'
import { gerarPixCopiaECola } from '@/lib/pix'

describe('conciliação do extrato: quem pagou é o cliente?', () => {
  it('CNPJ completo no extrato tem de ser igual ao do cliente', () => {
    const memo = 'Transferência recebida pelo Pix - EMPRESA EXEMPLO LTDA - 11.222.333/0001-81 - BCO'
    expect(pagadorConfere(memo, '11.222.333/0001-81', 'Empresa Exemplo')).toBe(true)
    expect(pagadorConfere(memo, '99.888.777/0001-66', 'Empresa Exemplo')).toBe(false)
  })

  it('CPF mascarado: confere os 6 dígitos do meio', () => {
    const memo = 'Transferência recebida pelo Pix - FULANO DE TAL - •••.456.789-•• - BCO'
    expect(pagadorConfere(memo, '123.456.789-09', 'Outro Nome')).toBe(true)
    expect(pagadorConfere(memo, '123.111.222-09', 'Fulano de Tal')).toBe(false)
  })

  it('sem documento: precisa de duas palavras do nome, ignorando acento', () => {
    expect(pagadorConfere('Pix recebido - JOSE FABRICIO PEREIRA', null, 'José Fabrício')).toBe(true)
    expect(pagadorConfere('Pix recebido - JOSE ANTONIO SOUZA', null, 'José Fabrício')).toBe(false)
  })

  it('palavras comuns (Mitra, Paróquia...) não bastam para confirmar', () => {
    expect(pagadorConfere('Pix - MITRA DIOCESANA DE MARILIA', null, 'Mitra Diocesana de Marília Paróquia São Bento')).toBe(false)
    expect(pagadorConfere('Pix - MITRA DIOCESANA PAROQUIA SAO BENTO', null, 'Mitra Diocesana de Marília Paróquia São Bento')).toBe(true)
  })
})

describe('categoria automática do lançamento', () => {
  const receita = (description: string, extra = {}) => categoriaSugerida({ type: 'RECEITA', description, ...extra })
  const despesa = (description: string) => categoriaSugerida({ type: 'DESPESA', description })

  it('receitas', () => {
    expect(receita('Qualquer coisa', { saleId: 'v1' })).toBe('Vendas de produtos')
    expect(receita('NF-e 128 — Cliente')).toBe('Vendas de produtos')
    expect(receita('Qualquer coisa', { serviceOrderId: 'os1' })).toBe('Serviços')
    expect(receita('NFS-e 298 — Paróquia')).toBe('Serviços')
    expect(receita('Reembolso de compra')).toBe('Recebimentos diversos')
    expect(receita('Transferência recebida pelo Pix - FULANO')).toBe('Serviços sem nota')
  })

  it('despesas', () => {
    expect(despesa('Pagamento DAS Simples Nacional')).toBe('Impostos e taxas')
    expect(despesa('Honorários do contador')).toBe('Contabilidade')
    expect(despesa('Reforma da fachada')).toBe('Manutenção e reforma da loja')
    expect(despesa('Posto de combustível')).toBe('Veículo')
    expect(despesa('Compra no Mercado Livre')).toBe('Compras de mercadorias e peças')
    expect(despesa('Pagamento de fatura')).toBe('Cartão de crédito')
    expect(despesa('iFood')).toBe('Alimentação')
    expect(despesa('Tarifa de manutenção')).toBe('Tarifas bancárias')
    expect(despesa('Algo sem regra')).toBe('Outras despesas')
  })

  it('investimento e movimento do sócio não têm categoria', () => {
    expect(categoriaSugerida({ type: 'APLICACAO', description: 'Aplicação RDB' })).toBeNull()
  })

  it('toda categoria sugerida existe na lista padrão', () => {
    const nomes = new Set(CATEGORIAS_PADRAO.map(c => c.nome))
    for (const d of ['DAS', 'contador', 'reforma', 'posto ', 'amazon', 'fatura', 'ifood', 'curso', 'tarifa', 'xyz']) expect(nomes.has(despesa(d)!)).toBe(true)
    for (const d of ['NF-e 1', 'NFS-e 2', 'estorno', 'pix']) expect(nomes.has(receita(d)!)).toBe(true)
  })
})

describe('classificação das linhas do extrato', () => {
  it('investimento não é receita nem despesa', () => {
    expect(classificarExtrato('Aplicação RDB', -1000)).toBe('APLICACAO')
    expect(classificarExtrato('Resgate RDB', 1000)).toBe('RESGATE')
  })
  it('o resto segue o sinal do valor', () => {
    expect(classificarExtrato('Transferência recebida pelo Pix - CLIENTE', 150)).toBe('RECEITA')
    expect(classificarExtrato('Pagamento de boleto', -80)).toBe('DESPESA')
  })
  it('rótulos em português', () => {
    expect(rotuloTipo('APORTE')).toBe('Aporte do sócio')
    expect(rotuloTipo('DESCONHECIDO')).toBe('DESCONHECIDO')
  })
})

describe('faturamento com nota × sem nota', () => {
  const r = (extra: Partial<Parameters<typeof origemReceita>[0]>) => origemReceita({ description: 'Recebimento', notes: null, paymentMethod: null, category: null, sale: null, serviceOrder: null, ...extra })

  it('venda com NF-e ou OS com NFS-e contam como com nota', () => {
    expect(r({ sale: { invoiceNumber: null, nfeEmissoes: [{ id: 'n1' }] } })).toBe('COM_NOTA')
    expect(r({ sale: { invoiceNumber: '133', nfeEmissoes: [] } })).toBe('COM_NOTA')
    expect(r({ serviceOrder: { nfseEmissoes: [{ id: 's1' }] } })).toBe('COM_NOTA')
  })
  it('recebimento do extrato anotado com a nota conta como com nota', () => {
    expect(r({ notes: 'NFS-e nº 298' })).toBe('COM_NOTA')
    expect(r({ notes: 'chave 35290052211222333000181000000000029826117430897520' })).toBe('COM_NOTA')
  })
  it('venda ou OS sem nota e Pix avulso contam como sem nota', () => {
    expect(r({ sale: { invoiceNumber: null, nfeEmissoes: [] } })).toBe('SEM_NOTA')
    expect(r({ serviceOrder: { nfseEmissoes: [] } })).toBe('SEM_NOTA')
    expect(r({})).toBe('SEM_NOTA')
  })
  it('reembolsos ficam em outros', () => {
    expect(r({ category: { name: 'Recebimentos diversos' } })).toBe('OUTROS')
  })
})

describe('leitura do extrato OFX', () => {
  const ofx = `OFXHEADER:100
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>CREDIT</TRNTYPE><DTPOSTED>20261103000000[-3:BRT]</DTPOSTED><TRNAMT>199.00</TRNAMT><FITID>abc-1</FITID><MEMO>Transferência recebida pelo Pix - CLIENTE</MEMO></STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261105000000[-3:BRT]
<TRNAMT>-80,50
<FITID>abc-2
<MEMO>Pagamento de boleto
</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`

  it('lê valor, data, descrição e identificador, do mais recente para o mais antigo', () => {
    const t = parseOfx(ofx)
    expect(t).toHaveLength(2)
    expect(t[0]).toMatchObject({ id: 'abc-2', type: 'DEBIT', amount: -80.5, description: 'Pagamento de boleto' })
    expect(t[1]).toMatchObject({ id: 'abc-1', type: 'CREDIT', amount: 199, description: 'Transferência recebida pelo Pix - CLIENTE' })
    expect(t[1].date.toISOString()).toBe('2026-11-03T12:00:00.000Z')
  })
  it('arquivo sem lançamentos devolve lista vazia', () => {
    expect(parseOfx('<OFX></OFX>')).toEqual([])
  })
})

describe('parcelas e datas', () => {
  it('a soma das parcelas é sempre o total; a diferença vai na última', () => {
    expect(dividirEmParcelas(3898, 3)).toEqual([1299.33, 1299.33, 1299.34])
    expect(dividirEmParcelas(100, 1)).toEqual([100])
    for (const [total, n] of [[3899.04, 12], [1189, 6], [0.05, 3], [3840, 10]] as const) {
      const p = dividirEmParcelas(total, n)
      expect(p).toHaveLength(n)
      expect(Math.round(p.reduce((s, v) => s + v, 0) * 100)).toBe(Math.round(total * 100))
    }
  })
  it('data de vencimento não muda de dia por causa do fuso', () => {
    expect(formatarDataUTC('2026-11-10')).toBe('10/11/2026')
    expect(formatarDataUTC(new Date('2026-11-10T00:00:00Z'))).toBe('10/11/2026')
  })
})

describe('limite do MEI (só notas fiscais)', () => {
  const base = { ano: 2026, hoje: '2026-11-09', notasProduto: 23790.77, notasServico: 34029.2, recebidoComNota: 36800 }

  it('soma serviço + produto e compara com o limite', () => {
    const r = resumoMei(base)
    expect(limiteMei(2026)).toBe(81000)
    expect(r.base).toBeCloseTo(57819.97, 2)
    expect(r.percentual).toBeCloseTo(71.38, 1)
    expect(r.restante).toBeCloseTo(23180.03, 2)
    expect(r.teto).toBeCloseTo(97200, 2)
    expect(r.situacao).toBe('ATENCAO')
  })
  it('previsão no ritmo do ano e quanto cabe por mês', () => {
    const r = resumoMei(base)
    expect(r.projecao!).toBeGreaterThan(r.base)
    expect(r.projecao!).toBeLessThan(81000)
    expect(r.podeFaturarPorMes!).toBeGreaterThan(0)
  })
  it('faixas de aviso', () => {
    const s = (servico: number) => resumoMei({ ...base, notasProduto: 0, notasServico: servico }).situacao
    expect(s(20000)).toBe('TRANQUILO')
    expect(s(75000)).toBe('PERTO')
    expect(s(85000)).toBe('ACIMA')
    expect(s(100000)).toBe('ESTOUROU')
  })
  it('ano já fechado não tem previsão', () => {
    const r = resumoMei({ ...base, ano: 2025 })
    expect(r.projecao).toBeNull()
    expect(r.mediaMensal).toBeNull()
  })
})

describe('código de barras e Pix', () => {
  it('confere o dígito verificador do GTIN', () => {
    expect(gtinValido('4006381333931')).toBe(true) // EAN-13
    expect(gtinValido('4006381333932')).toBe(false)
    expect(gtinValido('73513537')).toBe(true) // EAN-8
    expect(gtinValido('SEM GTIN')).toBe(false)
    expect(gtinValido('123')).toBe(false)
  })
  it('Pix copia e cola no padrão do Banco Central', () => {
    const pix = gerarPixCopiaECola({ pixKey: 'chave@exemplo.com', merchantName: 'Empresa Açaí & Cia', merchantCity: 'Marília', amount: 120, txid: 'COB-2026/11' })
    expect(pix.startsWith('000201')).toBe(true)
    expect(pix).toContain('br.gov.bcb.pix')
    expect(pix).toContain('chave@exemplo.com')
    expect(pix).toContain('5406120.00')
    expect(pix).toContain('5917Empresa Acai  Cia') // sem acento nem símbolo
    expect(pix).toContain('6007Marilia')
    expect(pix).toContain('COB202611')
    expect(pix).toMatch(/6304[0-9A-F]{4}$/)
  })
  it('sem valor, o Pix sai sem o campo de valor', () => {
    expect(gerarPixCopiaECola({ pixKey: 'k', merchantName: 'A', merchantCity: 'B', amount: 0 })).not.toMatch(/5303986540/)
  })
})
