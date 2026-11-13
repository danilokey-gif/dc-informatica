import { describe, it, expect } from 'vitest'
import { montarXmlPedRegEventoCancelamento } from '@/lib/nfse/evento'

// Chave fictícia de NFS-e (50 dígitos): município(7) + ambiente(1) + tipo inscrição(1) + CNPJ(14) + nNFSe(13) + AAMM(4) + código(9) + DV(1).
const CHAVE = '35290052211222333000181000000000029926114145982610'
const tag = (xml: string, nome: string) => xml.match(new RegExp(`<${nome}>([^<]*)</${nome}>`))?.[1]

describe('NFS-e: pedido de cancelamento (esquema pedRegEvento v1.01)', () => {
  const base = { ambiente: 'producao' as const, chaveAcesso: CHAVE, documentoAutor: '11222333000181', cMotivo: '1' as const, xMotivo: 'Endereco do cliente incorreto' }

  it('o identificador é PRE + chave + 101101 (59 caracteres, padrão do XSD)', () => {
    const { id, xml } = montarXmlPedRegEventoCancelamento(base)
    expect(id).toBe(`PRE${CHAVE}101101`)
    expect(id).toHaveLength(59)
    // Padrão TSIdPedRegEvt do XSD oficial.
    expect(id).toMatch(/^PRE[0-9]{8}(1[0-9]{14}|2[0-9A-Z]{14})[0-9]{33}$/)
    expect(xml).toContain(`Id="${id}"`)
  })

  it('não leva o campo nPedRegEvento, que não existe na v1.01', () => {
    expect(montarXmlPedRegEventoCancelamento(base).xml).not.toContain('nPedRegEvento')
  })

  it('campos do cancelamento na ordem do esquema', () => {
    const { xml } = montarXmlPedRegEventoCancelamento(base)
    const ordem = ['tpAmb', 'verAplic', 'dhEvento', 'CNPJAutor', 'chNFSe', 'e101101'].map(t => xml.indexOf(`<${t}>`))
    expect(ordem.every(p => p > 0)).toBe(true)
    expect([...ordem].sort((a, b) => a - b)).toEqual(ordem)
    expect(tag(xml, 'tpAmb')).toBe('1')
    expect(tag(xml, 'chNFSe')).toBe(CHAVE)
    expect(tag(xml, 'xDesc')).toBe('Cancelamento de NFS-e')
    expect(tag(xml, 'cMotivo')).toBe('1')
    expect(tag(xml, 'xMotivo')).toBe('Endereco do cliente incorreto')
  })

  it('autor pessoa física usa CPFAutor; homologação usa tpAmb 2', () => {
    const { xml } = montarXmlPedRegEventoCancelamento({ ...base, ambiente: 'homologacao', documentoAutor: '123.456.789-09' })
    expect(tag(xml, 'CPFAutor')).toBe('12345678909')
    expect(xml).not.toContain('<CNPJAutor>')
    expect(tag(xml, 'tpAmb')).toBe('2')
  })

  it('escapa caracteres especiais no motivo', () => {
    const { xml } = montarXmlPedRegEventoCancelamento({ ...base, xMotivo: 'Valor <errado> & duplicado' })
    expect(xml).toContain('Valor &lt;errado&gt; &amp; duplicado')
  })
})
