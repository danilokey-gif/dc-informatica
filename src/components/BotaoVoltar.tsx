'use client'

import { useRouter } from 'next/navigation'

/**
 * Volta para a tela de onde o usuário veio (lista de notas, OS, venda, orçamento...). Se a página
 * foi aberta direto (sem tela anterior no sistema), vai para o endereço padrão.
 */
export default function BotaoVoltar({ padrao, className = 'btn btn-outline' }: { padrao: string; className?: string }) {
  const router = useRouter()
  function voltar() {
    const veioDoSistema = document.referrer && new URL(document.referrer).origin === window.location.origin
    if (window.history.length > 1 && veioDoSistema) router.back()
    else router.push(padrao)
  }
  return <button type="button" className={className} onClick={voltar}>← Voltar</button>
}
