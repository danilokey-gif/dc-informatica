import { describe, it, expect, vi, afterEach } from 'vitest'
import { gzipSync, gunzipSync } from 'zlib'

// O certificado de verdade não é usado nos testes: o agente de TLS é trocado por um objeto vazio.
vi.mock('@/lib/nfse/certificate', () => ({ buildMtlsAgent: () => ({}) }))

import { NfseClient, mensagemDeErroEvento } from '@/lib/nfse/client'

const CHAVE = '35290052211222333000181000000000029926114145982610'
const cliente = () => new NfseClient({ ambiente: 'producao', pfxBuffer: Buffer.alloc(1), certPassword: 'x' })

function respostaDoGoverno(status: number, corpo: unknown) {
  const fetchFalso = vi.fn(async () => new Response(typeof corpo === 'string' ? corpo : JSON.stringify(corpo), { status }))
  vi.stubGlobal('fetch', fetchFalso)
  return fetchFalso
}

afterEach(() => vi.unstubAllGlobals())

describe('NFS-e: envio do pedido de cancelamento à Sefin', () => {
  it('manda o XML compactado no campo pedidoRegistroEventoXmlGZipB64, na rota de eventos', async () => {
    const f = respostaDoGoverno(200, { eventoXmlGZipB64: gzipSync('<evento>ok</evento>').toString('base64') })
    const r = await cliente().registrarEvento(CHAVE, '<pedRegEvento>x</pedRegEvento>')

    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(`https://sefin.nfse.gov.br/SefinNacional/nfse/${CHAVE}/eventos`)
    expect(init.method).toBe('POST')
    const corpo = JSON.parse(init.body as string)
    expect(Object.keys(corpo)).toEqual(['pedidoRegistroEventoXmlGZipB64'])
    expect(gunzipSync(Buffer.from(corpo.pedidoRegistroEventoXmlGZipB64, 'base64')).toString()).toBe('<pedRegEvento>x</pedRegEvento>')
    expect(r.xmlEvento).toBe('<evento>ok</evento>')
  })

  it('aceita como sucesso uma resposta 201 sem o XML do evento', async () => {
    respostaDoGoverno(201, { tipoAmbiente: 1, versaoAplicativo: 'SefinNacional_1.6.0' })
    const r = await cliente().registrarEvento(CHAVE, '<x/>')
    expect(r.xmlEvento).toContain('SefinNacional')
  })

  it('recusa com código e descrição quando a Sefin explica o motivo', async () => {
    respostaDoGoverno(400, { erros: [{ Codigo: 'E0822', Descricao: 'O prazo para o cancelamento expirou', Complemento: 'chNFSe' }] })
    await expect(cliente().registrarEvento(CHAVE, '<x/>')).rejects.toThrow('[E0822] O prazo para o cancelamento expirou — chNFSe')
  })

  it('aceita o formato com "erro" em minúsculas', async () => {
    respostaDoGoverno(400, { erro: [{ codigo: 'E0001', descricao: 'Motivo qualquer' }] })
    await expect(cliente().registrarEvento(CHAVE, '<x/>')).rejects.toThrow('[E0001] Motivo qualquer')
  })

  it('HTTP 500 sem explicação traz o status e o corpo recebido', async () => {
    respostaDoGoverno(500, { tipoAmbiente: 1, erro: [] })
    await expect(cliente().registrarEvento(CHAVE, '<x/>')).rejects.toThrow(/HTTP 500.*tipoAmbiente/)
  })
})

describe('mensagem de erro dos eventos', () => {
  it('sem corpo, avisa que o governo não explicou', () => {
    expect(mensagemDeErroEvento(502, null)).toContain('o governo não explicou o motivo')
  })
  it('corpo de texto (página de erro) é cortado em 300 caracteres', () => {
    expect(mensagemDeErroEvento(500, 'x'.repeat(1000)).length).toBeLessThan(420)
  })
})
