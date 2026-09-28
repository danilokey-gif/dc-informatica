'use client'

import { useActionState } from 'react'
import { deleteProduct } from './actions'

interface DeleteProductButtonProps {
  productId: string
}

const initialState = { error: undefined as string | undefined }

export default function DeleteProductButton({ productId }: DeleteProductButtonProps) {
  const deleteAction = deleteProduct.bind(null, productId)
  const [state, formAction, isPending] = useActionState(
    async (_prev: typeof initialState) => {
      const result = await deleteAction()
      if (result?.error) return { error: result.error }
      return { error: undefined }
    },
    initialState
  )

  return (
    <div>
      {state.error && (
        <p style={{
          color: '#b91c1c',
          fontSize: '0.75rem',
          marginBottom: '0.25rem',
          maxWidth: '220px',
          lineHeight: '1.3'
        }}>
          ⚠️ {state.error}
        </p>
      )}
      <form action={formAction}>
        <button
          type="submit"
          disabled={isPending}
          onClick={(e) => {
            if (!confirm('Tem certeza que deseja excluir este produto?')) {
              e.preventDefault()
            }
          }}
          style={{
            background: 'none',
            border: 'none',
            color: isPending ? 'var(--text-muted)' : '#dc2626',
            cursor: isPending ? 'not-allowed' : 'pointer',
            fontWeight: 500,
            opacity: isPending ? 0.6 : 1,
          }}
        >
          {isPending ? 'Excluindo...' : 'Excluir'}
        </button>
      </form>
    </div>
  )
}
