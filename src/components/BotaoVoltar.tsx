'use client'

import { useRouter } from 'next/navigation'
import { CHAVE_NAVEGACAO } from './RastreadorNavegacao'

/**
 * Volta para a tela de onde o usuário veio (lista de notas, OS, venda, orçamento...). Se a página
 * foi aberta direto (sem tela anterior no sistema), vai para o endereço padrão.
 */
export default function BotaoVoltar({ padrao, className = 'btn btn-outline' }: { padrao: string; className?: string }) {
  const router = useRouter()
  function voltar() {
    let telasVisitadas = 0
    try { telasVisitadas = Number(sessionStorage.getItem(CHAVE_NAVEGACAO) || '0') } catch { /* segue com o padrão */ }
    if (telasVisitadas > 1 && window.history.length > 1) router.back()
    else router.push(padrao)
  }
  return <button type="button" className={className} onClick={voltar}>← Voltar</button>
}
