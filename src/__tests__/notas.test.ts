import { describe, it, expect } from 'vitest'
import { montarXmlDps, NBS_PADRAO } from '@/lib/nfse/dps'
import { montarXmlNfe, cfopDevolucao, montarEventoCancelamento, type NfeInput } from '@/lib/nfe/xml'
import { lerNotaOriginal, notaEhDaEmpresa, quantidadesDevolvidas } from '@/lib/nfe/devolucao'

// Dados fictícios (nenhum documento real).
const CNPJ = '11222333000181'
const CPF_CLIENTE = '12345678909'
const tag = (xml: string, nome: string) => xml.match(new RegExp(`<${nome}>([^<]*)</${nome}>`))?.[1]

describe('NFS-e: montagem da DPS', () => {
  const base = {
    ambiente: 'producao' as const,
    codigoMunicipio: '3529005',
    serie: '1',
    numero: 42,
    dataCompetencia: new Date('2026-11-09T15:00:00Z'),
    prestador: { documento: CNPJ },
    tomador: { documento: CPF_CLIENTE, nome: 'Cliente de Teste' },
    servico: { codigoTributacaoNacional: '140101', descricao: 'Manutenção de computador', valor: 199 },
    aliquotaIss: 0,
    regimeTributario: 'MEI' as const,
  }

  it('monta o identificador da DPS no padrão nacional', () => {
    const { id, xml } = montarXmlDps(base)
    expect(id).toBe(`DPS3529005` + '2' + CNPJ + '00001' + '000000000000042')
    expect(id).toHaveLength(45)
    expect(xml).toContain(`Id="${id}"`)
  })

  it('leva ambiente, código de serviço, valor e a marca de MEI', () => {
    const { xml } = montarXmlDps(base)
    expect(tag(xml, 'tpAmb')).toBe('1')
    expect(tag(xml, 'cTribNac')).toBe('140101')
    expect(tag(xml, 'opSimpNac')).toBe('2') // 2 = MEI
    expect(xml).toContain('199.00')
    expect(xml).toContain(`<CNPJ>${CNPJ}</CNPJ>`)
    expect(xml).toContain(`<CPF>${CPF_CLIENTE}</CPF>`)
  })

  it('homologação sai com tpAmb 2', () => {
    expect(tag(montarXmlDps({ ...base, ambiente: 'homologacao' }).xml, 'tpAmb')).toBe('2')
  })

  it("leiaute 'atual' (produção hoje) não leva os campos da Reforma Tributária", () => {
    const { xml } = montarXmlDps({ ...base, leiaute: 'atual' })
    expect(xml).not.toContain('<finNFSe>')
    expect(xml).not.toContain('<IBSCBS>')
    expect(xml).not.toContain('<cNBS>')
  })

  it("leiaute 'nt009' leva finNFSe, IBS/CBS e a NBS (padrão quando não configurada)", () => {
    const { xml } = montarXmlDps({ ...base, leiaute: 'nt009', rtc: { cIndOp: '050101' } })
    expect(tag(xml, 'finNFSe')).toBe('0')
    expect(xml).toContain('<IBSCBS>')
    expect(tag(xml, 'cIndOp')).toBe('050101')
    expect(tag(xml, 'cNBS')).toBe(NBS_PADRAO)
    expect(tag(xml, 'cClassTrib')).toBe('000001')
  })

  it("leiaute 'nt009' usa a NBS configurada", () => {
    const { xml } = montarXmlDps({ ...base, leiaute: 'nt009', rtc: { cIndOp: '050102', cNbs: '115022000' } })
    expect(tag(xml, 'cNBS')).toBe('115022000')
    expect(tag(xml, 'cIndOp')).toBe('050102')
  })

  it('escapa caracteres especiais na descrição', () => {
    const { xml } = montarXmlDps({ ...base, servico: { ...base.servico, descricao: 'Troca de HD & SSD <urgente>' } })
    expect(xml).toContain('Troca de HD &amp; SSD &lt;urgente&gt;')
  })
})

describe('NF-e: montagem da nota de produto', () => {
  const endereco = { logradouro: 'Rua de Teste', numero: '100', bairro: 'Centro', codigoMunicipio: '3529005', nomeMunicipio: 'Marilia', uf: 'SP', cep: '17500000' }
  const venda: NfeInput = {
    ambiente: 'producao',
    serie: '2',
    numero: 9,
    emitente: { cnpj: CNPJ, razaoSocial: 'Empresa de Teste', inscricaoEstadual: '123456789012', crt: '4', endereco },
    destinatario: { documento: CPF_CLIENTE, nome: 'Cliente de Teste', endereco },
    itens: [
      { codigo: ' P1 ', descricao: 'Pen drive 8GB', ncm: '85235190', cfop: '5102', unidade: 'UN', quantidade: 2, valorUnitario: 19.99 },
      { codigo: 'P2', descricao: 'Cabo HDMI', ncm: '85444200', cfop: '5102', unidade: 'UN', quantidade: 1, valorUnitario: 30 },
    ],
    formaPagamento: 'pix',
  }

  /** Dígito verificador da chave, calculado de forma independente (módulo 11, pesos 2 a 9). */
  const dvDaChave = (chave43: string) => {
    let soma = 0
    chave43.split('').reverse().forEach((d, i) => { soma += Number(d) * (2 + (i % 8)) })
    const resto = soma % 11
    return resto < 2 ? 0 : 11 - resto
  }

  it('gera chave de acesso de 44 dígitos com dígito verificador correto', () => {
    const { chaveAcesso, xml } = montarXmlNfe(venda)
    expect(chaveAcesso).toMatch(/^\d{44}$/)
    expect(Number(chaveAcesso[43])).toBe(dvDaChave(chaveAcesso.slice(0, 43)))
    expect(chaveAcesso.slice(0, 2)).toBe('35') // SP
    expect(chaveAcesso.slice(6, 20)).toBe(CNPJ)
    expect(chaveAcesso.slice(20, 22)).toBe('55') // modelo NF-e
    expect(xml).toContain(`Id="NFe${chaveAcesso}"`)
  })

  it('venda de MEI: CRT 4, finalidade normal e sem o grupo IBS/CBS', () => {
    const { xml } = montarXmlNfe(venda)
    expect(tag(xml, 'CRT')).toBe('4')
    expect(tag(xml, 'finNFe')).toBe('1')
    expect(tag(xml, 'tpNF')).toBe('1')
    expect(tag(xml, 'tpAmb')).toBe('1')
    expect(xml).not.toContain('<IBSCBS>')
    expect(xml).not.toContain('<NFref>')
    expect(xml).toContain('<indIntermed>')
  })

  it('soma os itens no total da nota', () => {
    const { xml } = montarXmlNfe(venda)
    expect(tag(xml, 'vNF')).toBe('69.98') // 2 x 19,99 + 30,00
    expect(tag(xml, 'vProd')).toBe('39.98') // primeiro item
  })

  it('limpa espaços sobrando no código do produto (evita a rejeição 225)', () => {
    expect(montarXmlNfe(venda).xml).toContain('<cProd>P1</cProd>')
  })

  it('produto sem código de barras sai como SEM GTIN', () => {
    expect(montarXmlNfe(venda).xml).toContain('<cEAN>SEM GTIN</cEAN>')
  })

  it('em homologação o destinatário vira o nome padrão de teste', () => {
    const { xml } = montarXmlNfe({ ...venda, ambiente: 'homologacao' })
    expect(xml).toContain('NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL')
    expect(tag(xml, 'tpAmb')).toBe('2')
  })

  describe('nota de devolução', () => {
    const chaveOriginal = '35260711222333000181550020000000021000000019'

    it('CFOP conforme o tipo e o estado', () => {
      expect(cfopDevolucao('compra', false)).toBe('5202')
      expect(cfopDevolucao('compra', true)).toBe('6202')
      expect(cfopDevolucao('venda', false)).toBe('1202')
      expect(cfopDevolucao('venda', true)).toBe('2202')
    })

    it('devolução de venda: entrada, referencia a nota original, sem pagamento', () => {
      const { xml } = montarXmlNfe({
        ...venda, formaPagamento: 'outro',
        itens: [{ ...venda.itens[0], cfop: '1202', quantidade: 1 }],
        devolucao: { tipo: 'venda', chaveReferenciada: chaveOriginal, observacao: 'DEVOLUCAO DE VENDA' },
      })
      expect(tag(xml, 'finNFe')).toBe('4')
      expect(tag(xml, 'tpNF')).toBe('0') // entrada
      expect(tag(xml, 'refNFe')).toBe(chaveOriginal)
      expect(tag(xml, 'CSOSN')).toBe('900')
      expect(tag(xml, 'tPag')).toBe('90')
      expect(tag(xml, 'vPag')).toBe('0.00')
      expect(tag(xml, 'indPres')).toBe('0')
      expect(xml).not.toContain('<indIntermed>')
      expect(xml).toContain('DEVOLUCAO DE VENDA')
    })

    it('devolução de compra para fornecedor de outro estado: saída interestadual', () => {
      const fornecedor = { documento: '99888777000166', nome: 'Fornecedor de Teste', inscricaoEstadual: '555444333', endereco: { ...endereco, uf: 'SC', codigoMunicipio: '4205407', nomeMunicipio: 'Florianopolis' } }
      const { xml } = montarXmlNfe({
        ...venda, formaPagamento: 'outro', destinatario: fornecedor,
        itens: [{ ...venda.itens[0], cfop: cfopDevolucao('compra', true) }],
        devolucao: { tipo: 'compra', chaveReferenciada: chaveOriginal },
      })
      expect(tag(xml, 'tpNF')).toBe('1') // saída
      expect(tag(xml, 'idDest')).toBe('2') // outro estado
      expect(tag(xml, 'CFOP')).toBe('6202')
      expect(tag(xml, 'indFinal')).toBe('0')
      expect(xml).toContain('<indIEDest>1</indIEDest><IE>555444333</IE>')
    })
  })

  describe('leitura da nota original para a devolução', () => {
    const { xml, chaveAcesso } = montarXmlNfe(venda)

    it('lê itens, chave e o cliente da venda', () => {
      const original = lerNotaOriginal(xml, 'venda')
      expect(original.chave).toBe(chaveAcesso)
      expect(original.numero).toBe('9')
      expect(original.itens).toHaveLength(2)
      expect(original.itens[0]).toMatchObject({ nItem: 1, codigo: 'P1', quantidade: 2, ncm: '85235190', gtin: null })
      expect(original.itens[0].valorUnitario).toBeCloseTo(19.99, 6)
      expect(original.parte.documento).toBe(CPF_CLIENTE)
      expect(original.parte.endereco?.uf).toBe('SP')
    })

    it('na devolução de compra a outra parte é quem emitiu a nota', () => {
      expect(lerNotaOriginal(xml, 'compra').parte.documento).toBe(CNPJ)
    })

    it('confere se a nota é da empresa', () => {
      const original = lerNotaOriginal(xml, 'venda')
      expect(notaEhDaEmpresa(original, 'venda', '11.222.333/0001-81')).toBe(true)
      expect(notaEhDaEmpresa(original, 'venda', '99888777000166')).toBe(false)
      // Compra feita no CPF do dono não é da empresa: a devolução real fica bloqueada.
      expect(notaEhDaEmpresa(original, 'compra', CNPJ)).toBe(false)
    })

    it('soma o que já foi devolvido em notas anteriores', () => {
      const devolvido = quantidadesDevolvidas([xml, xml, null])
      expect(devolvido.get('P1')).toBe(4)
      expect(devolvido.get('P2')).toBe(2)
    })

    it('recusa XML sem chave de acesso', () => {
      expect(() => lerNotaOriginal('<NFe><infNFe></infNFe></NFe>', 'venda')).toThrow()
    })
  })

  describe('cancelamento', () => {
    const chave = '35260711222333000181550020000000021000000019'
    it('exige justificativa de 15 a 255 caracteres', () => {
      expect(() => montarEventoCancelamento({ cnpjEmitente: CNPJ, chaveAcesso: chave, tpAmb: '1', protocolo: '135260000000001', justificativa: 'curta' })).toThrow(/15 e 255/)
    })
    it('monta o evento 110111 com protocolo e justificativa', () => {
      const { xml } = montarEventoCancelamento({ cnpjEmitente: CNPJ, chaveAcesso: chave, tpAmb: '1', protocolo: '135260000000001', justificativa: 'Erro no valor do produto informado' })
      expect(tag(xml, 'tpEvento')).toBe('110111')
      expect(tag(xml, 'nProt')).toBe('135260000000001')
      expect(tag(xml, 'chNFe')).toBe(chave)
    })
  })
})
