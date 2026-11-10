'use client'

import { useState } from 'react'

/**
 * Envia a nota fiscal pelo WhatsApp.
 * - No computador: abre a conversa do cliente (WhatsApp Web) com a mensagem e o link do PDF.
 * - No celular: compartilha o próprio arquivo PDF (a pessoa escolhe o WhatsApp e o contato);
 *   se o aparelho não deixar, cai no envio por link.
 */
export default function BotaoWhatsAppNota({ urlPdf, nomeArquivo, texto, linkWhatsApp, temTelefone, compacto = false }: {
  urlPdf: string
  nomeArquivo: string
  texto: string
  linkWhatsApp: string
  temTelefone: boolean
  compacto?: boolean
}) {
  const [preparando, setPreparando] = useState(false)

  async function aoClicar(e: React.MouseEvent<HTMLAnchorElement>) {
    const celular = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches
    if (!celular || typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') return // segue o link normal
    e.preventDefault()
    setPreparando(true)
    try {
      const resposta = await fetch(urlPdf)
      if (!resposta.ok) throw new Error('PDF indisponível')
      const arquivo = new File([await resposta.blob()], nomeArquivo, { type: 'application/pdf' })
      if (!navigator.canShare({ files: [arquivo] })) throw new Error('Aparelho não compartilha arquivo')
      await navigator.share({ files: [arquivo], text: texto })
    } catch (erro) {
      // Fechou a janela de compartilhar: não faz nada. Qualquer outro problema: envia por link.
      if (!(erro instanceof Error && erro.name === 'AbortError')) window.location.href = linkWhatsApp
    } finally {
      setPreparando(false)
    }
  }

  const titulo = temTelefone ? 'Enviar a nota para o WhatsApp do cliente' : 'Cliente sem telefone no cadastro: o WhatsApp abre para você escolher o contato'

  if (compacto) {
    return (
      <a href={linkWhatsApp} target="_blank" rel="noopener noreferrer" onClick={aoClicar} title={titulo}
        style={{ color: '#128C7E', textDecoration: 'underline', fontWeight: 600, whiteSpace: 'nowrap' }}>
        {preparando ? 'Abrindo…' : 'WhatsApp'}
      </a>
    )
  }
  return (
    <a href={linkWhatsApp} target="_blank" rel="noopener noreferrer" onClick={aoClicar} title={titulo} className="btn"
      style={{ backgroundColor: '#25D366', color: '#fff', fontWeight: 600, whiteSpace: 'nowrap' }}>
      {preparando ? 'Abrindo…' : '💬 Enviar no WhatsApp'}
    </a>
  )
}
