'use client'

import { useTransition } from 'react'
import { deleteSale } from './actions'

export default function DeleteSaleButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    if (confirm('Tem certeza que deseja excluir esta venda? O estoque será devolvido e o lançamento financeiro excluído.')) {
      startTransition(async () => {
        try {
          await deleteSale(id)
          alert('Venda excluída com sucesso.')
        } catch (err: any) {
          alert('Erro ao excluir venda: ' + err.message)
        }
      })
    }
  }

  return (
    <button 
      onClick={handleDelete}
      disabled={isPending}
      className="text-danger ml-2" 
      style={{ fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}
    >
      {isPending ? 'Excluindo...' : 'Excluir'}
    </button>
  )
}
