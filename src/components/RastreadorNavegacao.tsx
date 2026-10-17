'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

export const CHAVE_NAVEGACAO = 'dc-telas-visitadas'

/**
 * Conta as telas abertas dentro do sistema nesta janela. O botão Voltar usa isso para saber se
 * existe uma tela anterior do próprio sistema (o document.referrer não muda na navegação interna
 * do Next.js, e no aplicativo instalado ele vem vazio).
 */
export default function RastreadorNavegacao() {
  const caminho = usePathname()
  useEffect(() => {
    try {
      const n = Number(sessionStorage.getItem(CHAVE_NAVEGACAO) || '0')
      sessionStorage.setItem(CHAVE_NAVEGACAO, String(n + 1))
    } catch { /* sem sessionStorage: o Voltar usa o endereço padrão */ }
  }, [caminho])
  return null
}
