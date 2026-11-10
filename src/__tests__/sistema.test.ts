import { describe, it, expect, vi } from 'vitest'

// Estes módulos falam com o banco e com o Next; os testes usam só as funções de cálculo.
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('../lib/prisma', () => ({ prisma: {} }))
vi.mock('next/headers', () => ({ headers: async () => new Map() }))

import { backupsParaApagar } from '@/lib/backup'
import { tokenDaNota, lerTokenDaNota, telefoneWhatsApp, montarEnvioWhatsApp } from '@/lib/nota-whatsapp'
import { encryptSecret, decryptSecret } from '@/lib/crypto'
import { hojeEmBrasilia } from '@/lib/cobranca-mensal'

describe('backup: quais arquivos antigos saem', () => {
  const arq = (...nomes: string[]) => nomes.map(name => ({ name }))
  const apagar = (nomes: string[]) => backupsParaApagar(arq(...nomes), '2026-11-09').map(a => a.name)

  it('mantém os últimos 30 dias', () => {
    expect(apagar(['backup-2026-11-09.json.gz', 'backup-2026-10-20.json.gz', 'backup-2026-10-10.json.gz'])).toEqual([])
  })
  it('apaga diários com mais de 30 dias', () => {
    expect(apagar(['backup-2026-10-09.json.gz', 'backup-2026-09-15.json.gz'])).toEqual(['backup-2026-10-09.json.gz', 'backup-2026-09-15.json.gz'])
  })
  it('mantém o backup do dia 1º de cada mês por um ano', () => {
    expect(apagar(['backup-2026-10-01.json.gz', 'backup-2025-12-01.json.gz'])).toEqual([])
    expect(apagar(['backup-2025-11-01.json.gz', 'backup-2025-06-01.json.gz'])).toEqual(['backup-2025-11-01.json.gz', 'backup-2025-06-01.json.gz'])
  })
  it('nunca mexe em arquivo que não é do backup automático', () => {
    expect(apagar(['minha-copia.zip', 'backup-manual-2020.json.gz', 'backup-2020-01-15.json.gz.bak'])).toEqual([])
  })
})

describe('link público da nota (WhatsApp)', () => {
  const id = 'cmw5d0ioe0003l008qagpwh5c'

  it('o link assinado volta para a mesma nota', () => {
    expect(lerTokenDaNota(tokenDaNota('nfse', id))).toEqual({ tipo: 'nfse', id })
    expect(lerTokenDaNota(tokenDaNota('nfe', id))).toEqual({ tipo: 'nfe', id })
  })
  it('recusa link adulterado, de outro tipo ou de outra nota', () => {
    const t = tokenDaNota('nfse', id)
    expect(lerTokenDaNota(t.slice(0, -1) + (t.endsWith('A') ? 'B' : 'A'))).toBeNull()
    expect(lerTokenDaNota('p' + t.slice(1))).toBeNull()
    expect(lerTokenDaNota(t.replace(id, 'cmw5d0ioe0003l008qagpwh5d'))).toBeNull()
    expect(lerTokenDaNota('abc')).toBeNull()
    expect(lerTokenDaNota('')).toBeNull()
  })
  it('a assinatura depende do segredo do servidor', () => {
    const t = tokenDaNota('nfse', id)
    const original = process.env.AUTH_SECRET
    process.env.AUTH_SECRET = 'outro-segredo'
    try { expect(lerTokenDaNota(t)).toBeNull() } finally { process.env.AUTH_SECRET = original }
  })

  it('telefone no formato do WhatsApp', () => {
    expect(telefoneWhatsApp('(14) 99999-1234')).toBe('5514999991234')
    expect(telefoneWhatsApp('14999991234')).toBe('5514999991234')
    expect(telefoneWhatsApp('+55 14 99999-1234')).toBe('5514999991234')
    expect(telefoneWhatsApp('(14) 3433-1234')).toBe('551434331234')
    expect(telefoneWhatsApp('99999-1234')).toBeNull() // sem DDD
    expect(telefoneWhatsApp('')).toBeNull()
    expect(telefoneWhatsApp(null)).toBeNull()
  })

  it('mensagem com número, valor e link do PDF', () => {
    const envio = montarEnvioWhatsApp({ tipo: 'nfse', id, numero: '298', valor: 199, empresa: 'Empresa de Teste', telefone: '5514999991234', origem: 'https://exemplo.test' })
    const url = new URL(envio.linkWhatsApp)
    const texto = url.searchParams.get('text')!
    expect(url.origin + url.pathname).toBe('https://wa.me/5514999991234')
    expect(texto).toContain('NFS-e) nº 298 da Empresa de Teste')
    expect(texto).toMatch(/R\$\s199,00/)
    expect(texto).toContain(`https://exemplo.test/nota/${tokenDaNota('nfse', id)}`)
    expect(envio.temTelefone).toBe(true)
    expect(envio.texto).not.toContain('https://')
  })
  it('sem telefone, abre o WhatsApp para escolher o contato', () => {
    const envio = montarEnvioWhatsApp({ tipo: 'nfe', id, numero: '9', valor: null, empresa: 'Empresa', telefone: null, origem: 'https://exemplo.test' })
    expect(envio.linkWhatsApp.startsWith('https://wa.me/?text=')).toBe(true)
    expect(envio.temTelefone).toBe(false)
    expect(envio.texto).toContain('nota fiscal (NF-e) nº 9')
  })
})

describe('criptografia dos segredos (senha do certificado, tokens)', () => {
  it('o que é criptografado volta igual', () => {
    const segredo = 'senha-do-certificado-çãé-123'
    const cifrado = encryptSecret(segredo)
    expect(cifrado).not.toContain(segredo)
    expect(decryptSecret(cifrado)).toBe(segredo)
  })
  it('cada criptografia gera um resultado diferente', () => {
    expect(encryptSecret('abc')).not.toBe(encryptSecret('abc'))
  })
  it('com outra chave do servidor não descriptografa', () => {
    const cifrado = encryptSecret('abc')
    const original = process.env.AUTH_SECRET
    process.env.AUTH_SECRET = 'outra-chave'
    try { expect(() => decryptSecret(cifrado)).toThrow(/AUTH_SECRET/) } finally { process.env.AUTH_SECRET = original }
  })
})

describe('cobrança mensal: data no horário de Brasília', () => {
  it('às 2h da manhã em UTC ainda é o dia anterior no Brasil', () => {
    const h = hojeEmBrasilia(new Date('2026-11-10T02:00:00Z'))
    expect(h.dia).toBe(9)
    expect(h.competencia).toBe('2026-11')
  })
  it('virada de mês', () => {
    const h = hojeEmBrasilia(new Date('2026-12-01T01:30:00Z'))
    expect(h.dia).toBe(30)
    expect(h.competencia).toBe('2026-11')
    expect(h.rotulo).toBe('11/2026')
  })
})
