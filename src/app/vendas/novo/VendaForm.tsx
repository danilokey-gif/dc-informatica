'use client'

import { useState } from 'react'
import { createSale } from '../actions'

interface Produto {
  id: string
  name: string
  salePrice: number
  stockQty: number
}

interface Cliente {
  id: string
  name: string
}

interface CartItem {
  productId: string
  name: string
  unitPrice: number
  quantity: number
  stockQty: number
}

export default function VendaForm({ produtos, clientes }: { produtos: Produto[]; clientes: Cliente[] }) {
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedProductId, setSelectedProductId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [error, setError] = useState('')

  const total = cart.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0)

  function handleAddItem() {
    setError('')
    const produto = produtos.find(p => p.id === selectedProductId)
    if (!produto) {
      setError('Selecione um produto.')
      return
    }
    if (quantity < 1) {
      setError('Quantidade inválida.')
      return
    }

    const jaNoCarrinho = cart.find(item => item.productId === produto.id)
    const quantidadeTotal = (jaNoCarrinho?.quantity || 0) + quantity

    if (quantidadeTotal > produto.stockQty) {
      setError(`Estoque insuficiente para "${produto.name}". Disponível: ${produto.stockQty}`)
      return
    }

    if (jaNoCarrinho) {
      setCart(cart.map(item => item.productId === produto.id ? { ...item, quantity: quantidadeTotal } : item))
    } else {
      setCart([...cart, { productId: produto.id, name: produto.name, unitPrice: produto.salePrice, quantity, stockQty: produto.stockQty }])
    }
    setSelectedProductId('')
    setQuantity(1)
  }

  function handleRemoveItem(productId: string) {
    setCart(cart.filter(item => item.productId !== productId))
  }

  return (
    <form action={createSale}>
      <div className="card mb-4">
        <h3 className="mb-4">Adicionar Produto</h3>
        <div className="flex gap-4" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="input-group" style={{ flex: 1, minWidth: '250px', marginBottom: 0 }}>
            <label className="input-label" htmlFor="produtoSelect">Produto</label>
            <select
              id="produtoSelect"
              className="input-field"
              value={selectedProductId}
              onChange={e => setSelectedProductId(e.target.value)}
            >
              <option value="">Selecione um produto...</option>
              {produtos.map(produto => (
                <option key={produto.id} value={produto.id}>
                  {produto.name} — {produto.salePrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} (estoque: {produto.stockQty})
                </option>
              ))}
            </select>
          </div>
          <div className="input-group" style={{ width: '120px', marginBottom: 0 }}>
            <label className="input-label" htmlFor="quantidade">Qtd.</label>
            <input
              type="number"
              id="quantidade"
              className="input-field"
              min={1}
              value={quantity}
              onChange={e => setQuantity(parseInt(e.target.value) || 1)}
            />
          </div>
          <button type="button" className="btn btn-outline" onClick={handleAddItem}>Adicionar</button>
        </div>
        {error && (
          <p style={{ color: '#b91c1c', fontSize: '0.875rem', marginTop: '0.75rem' }}>{error}</p>
        )}
      </div>

      <div className="card mb-4">
        <h3 className="mb-4">Carrinho</h3>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Produto</th>
                <th>Qtd.</th>
                <th>Preço Unit.</th>
                <th>Subtotal</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {cart.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-muted">Nenhum produto adicionado.</td>
                </tr>
              )}
              {cart.map(item => (
                <tr key={item.productId}>
                  <td>{item.name}</td>
                  <td>{item.quantity}</td>
                  <td>{item.unitPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                  <td>{(item.unitPrice * item.quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                  <td>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.productId)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 500 }}
                    >
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ textAlign: 'right', marginTop: '1rem', fontSize: '1.25rem', fontWeight: 'bold' }}>
          Total: {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </div>
      </div>

      <div className="card">
        <h3 className="mb-4">Finalizar Venda</h3>
        <div className="input-group">
          <label className="input-label" htmlFor="customerId">Cliente (opcional)</label>
          <select id="customerId" name="customerId" className="input-field" defaultValue="">
            <option value="">Cliente não identificado</option>
            {clientes.map(cliente => (
              <option key={cliente.id} value={cliente.id}>{cliente.name}</option>
            ))}
          </select>
        </div>

        <div className="input-group">
          <label className="input-label" htmlFor="paymentMethod">Forma de Pagamento *</label>
          <select id="paymentMethod" name="paymentMethod" className="input-field" required defaultValue="">
            <option value="" disabled>Selecione...</option>
            <option value="Dinheiro">Dinheiro</option>
            <option value="PIX">PIX</option>
            <option value="Cartão de Débito">Cartão de Débito</option>
            <option value="Cartão de Crédito">Cartão de Crédito</option>
          </select>
        </div>

        <input type="hidden" name="itemsJson" value={JSON.stringify(cart.map(item => ({ productId: item.productId, quantity: item.quantity })))} />

        <div style={{ marginTop: '2rem' }}>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.75rem' }} disabled={cart.length === 0}>
            Finalizar Venda
          </button>
        </div>
      </div>
    </form>
  )
}
