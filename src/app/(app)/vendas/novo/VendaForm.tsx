'use client'

import { useState } from 'react'
import { createSale } from '../actions'
import { createCustomerQuick } from '../../clientes/actions'
import SearchableSelect from '@/components/SearchableSelect'
import QuickCustomerModal, { QuickCustomerData } from '@/components/QuickCustomerModal'

interface Produto {
  id: string
  name: string
  salePrice: number
  stockQty: number
}

interface Cliente {
  id: string
  name: string
  document?: string | null
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
  const [localClientes, setLocalClientes] = useState<Cliente[]>(clientes)
  const [selectedProductId, setSelectedProductId] = useState('')
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [unitPriceInput, setUnitPriceInput] = useState<number | ''>('')
  const [error, setError] = useState('')
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState('')
  const [parcelas, setParcelas] = useState(1)
  const [jaPago, setJaPago] = useState(true)

  async function handleSaveNewCustomer(data: QuickCustomerData) {
    const newCustomer = await createCustomerQuick(data)
    setLocalClientes([...localClientes, newCustomer])
    setSelectedCustomerId(newCustomer.id)
  }

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

    if (unitPriceInput === '' || Number(unitPriceInput) < 0) {
      setError('Preço unitário inválido.')
      return
    }

    const jaNoCarrinho = cart.find(item => item.productId === produto.id)
    const quantidadeTotal = (jaNoCarrinho?.quantity || 0) + quantity

    if (quantidadeTotal > produto.stockQty) {
      setError(`Estoque insuficiente para "${produto.name}". Disponível: ${produto.stockQty}`)
      return
    }

    if (jaNoCarrinho) {
      setCart(cart.map(item => item.productId === produto.id ? { ...item, quantity: quantidadeTotal, unitPrice: Number(unitPriceInput) } : item))
    } else {
      setCart([...cart, { productId: produto.id, name: produto.name, unitPrice: Number(unitPriceInput), quantity, stockQty: produto.stockQty }])
    }
    setSelectedProductId('')
    setQuantity(1)
    setUnitPriceInput('')
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
            <SearchableSelect
              id="produtoSelect"
              value={selectedProductId}
              onValueChange={val => {
                setSelectedProductId(val)
                const p = produtos.find(x => x.id === val)
                if (p) setUnitPriceInput(p.salePrice)
                else setUnitPriceInput('')
              }}
              placeholder="Digite o nome do produto..."
              options={produtos.map(produto => ({
                value: produto.id,
                label: `${produto.name} — ${produto.salePrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} (estoque: ${produto.stockQty})`,
              }))}
            />
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
          <div className="input-group" style={{ width: '150px', marginBottom: 0 }}>
            <label className="input-label" htmlFor="unitPriceInput">Preço Unit.</label>
            <input
              type="number"
              id="unitPriceInput"
              className="input-field"
              min={0}
              step="0.01"
              value={unitPriceInput}
              onChange={e => setUnitPriceInput(e.target.value === '' ? '' : parseFloat(e.target.value))}
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
          <SearchableSelect
            id="customerId"
            name="customerId"
            value={selectedCustomerId}
            onValueChange={setSelectedCustomerId}
            placeholder="Cliente não identificado"
            options={localClientes.map(c => ({ 
              value: c.id, 
              label: c.document ? `${c.name} (${c.document})` : c.name 
            }))}
            onCreateNew={(name) => {
              setNewCustomerName(name)
              setShowCustomerModal(true)
            }}
          />
        </div>

        <div className="input-group">
          <label className="input-label" htmlFor="paymentMethod">Forma de Pagamento *</label>
          <select id="paymentMethod" name="paymentMethod" className="input-field" required defaultValue="">
            <option value="" disabled>Selecione...</option>
            <option value="Dinheiro">Dinheiro</option>
            <option value="PIX">PIX</option>
            <option value="Cartão de Débito">Cartão de Débito</option>
            <option value="Cartão de Crédito">Cartão de Crédito</option>
            <option value="Boleto">Boleto</option>
            <option value="Promissória">Promissória</option>
          </select>
        </div>

        <div className="flex gap-4" style={{ flexWrap: 'wrap' }}>
          <div className="input-group" style={{ flex: 1, minWidth: '150px' }}>
            <label className="input-label" htmlFor="parcelas">Parcelas</label>
            <select
              id="parcelas"
              name="parcelas"
              className="input-field"
              value={parcelas}
              onChange={(e) => {
                const val = Number(e.target.value)
                setParcelas(val)
                if (val > 1) setJaPago(false) // Se parcelar, assume-se que não está pago
              }}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                <option key={n} value={n}>{n}x</option>
              ))}
            </select>
          </div>

          <div className="input-group" style={{ flex: 1, minWidth: '150px', display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '1.5rem' }}>
            <input 
              type="checkbox" 
              id="jaPago" 
              name="jaPago" 
              value="1"
              checked={jaPago}
              onChange={(e) => setJaPago(e.target.checked)}
              style={{ width: '1.2rem', height: '1.2rem' }}
            />
            <label htmlFor="jaPago" style={{ cursor: 'pointer', margin: 0, fontWeight: 500 }}>
              {parcelas > 1 ? "1ª Parcela recebida no ato?" : "Recebido no ato?"}
            </label>
          </div>
        </div>

        <input type="hidden" name="itemsJson" value={JSON.stringify(cart.map(item => ({ productId: item.productId, quantity: item.quantity })))} />

        <div style={{ marginTop: '2rem' }}>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.75rem' }} disabled={cart.length === 0}>
            Finalizar Venda
          </button>
        </div>
      </div>

      {showCustomerModal && (
        <QuickCustomerModal
          initialName={newCustomerName}
          onClose={() => setShowCustomerModal(false)}
          onSave={handleSaveNewCustomer}
        />
      )}
    </form>
  )
}
