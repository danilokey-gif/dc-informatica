'use client'

import { useState } from 'react'
import { createQuote } from '../actions'
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
  id: string
  productId?: string
  name: string
  unitPrice: number
  quantity: number
  isService: boolean
}

export default function QuoteForm({ produtos, clientes }: { produtos: Produto[], clientes: Cliente[] }) {
  const [localClientes, setLocalClientes] = useState(clientes)
  const [cart, setCart] = useState<CartItem[]>([])
  
  const [itemType, setItemType] = useState<'product' | 'service'>('product')
  const [selectedProductId, setSelectedProductId] = useState('')
  const [customName, setCustomName] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [unitPriceInput, setUnitPriceInput] = useState<number | ''>('')
  
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState('')

  async function handleSaveNewCustomer(data: QuickCustomerData) {
    const newCustomer = await createCustomerQuick(data)
    setLocalClientes([...localClientes, newCustomer])
    setSelectedCustomerId(newCustomer.id)
  }

  const total = cart.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0)

  function handleAddItem() {
    setError('')
    
    let finalName = ''
    let finalProductId = undefined
    let finalIsService = itemType === 'service'

    if (itemType === 'product') {
      const produto = produtos.find(p => p.id === selectedProductId)
      if (produto) {
        finalName = produto.name
        finalProductId = produto.id
      } else if (customName.trim()) {
        finalName = customName.trim()
      } else {
        setError('Selecione um produto ou digite o nome.')
        return
      }
    } else {
      if (!customName.trim()) {
        setError('Digite o nome do serviço.')
        return
      }
      finalName = customName.trim()
    }

    if (quantity < 1) {
      setError('Quantidade inválida.')
      return
    }

    if (unitPriceInput === '' || Number(unitPriceInput) < 0) {
      setError('Preço unitário inválido.')
      return
    }

    setCart([...cart, { 
      id: crypto.randomUUID(),
      productId: finalProductId, 
      name: finalName, 
      unitPrice: Number(unitPriceInput), 
      quantity, 
      isService: finalIsService 
    }])
    
    setSelectedProductId('')
    setCustomName('')
    setQuantity(1)
    setUnitPriceInput('')
  }

  function handleRemoveItem(id: string) {
    setCart(cart.filter(item => item.id !== id))
  }

  return (
    <form action={createQuote}>
      <div className="card mb-4">
        <h3 className="mb-4">Adicionar Item</h3>
        
        <div className="flex gap-4 mb-4">
          <label className="flex gap-2" style={{ alignItems: 'center' }}>
            <input 
              type="radio" 
              name="itemType" 
              value="product" 
              checked={itemType === 'product'} 
              onChange={() => { setItemType('product'); setSelectedProductId(''); setCustomName(''); setUnitPriceInput('') }} 
            />
            Produto
          </label>
          <label className="flex gap-2" style={{ alignItems: 'center' }}>
            <input 
              type="radio" 
              name="itemType" 
              value="service" 
              checked={itemType === 'service'} 
              onChange={() => { setItemType('service'); setSelectedProductId(''); setCustomName(''); setUnitPriceInput('') }} 
            />
            Serviço
          </label>
        </div>

        <div className="flex gap-4" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
          {itemType === 'product' ? (
            <div className="input-group" style={{ flex: 1, minWidth: '250px', marginBottom: 0 }}>
              <label className="input-label">Produto (Busca)</label>
              <SearchableSelect
                id="produtoSelect"
                value={selectedProductId}
                onValueChange={val => {
                  setSelectedProductId(val)
                  setCustomName('')
                  const p = produtos.find(x => x.id === val)
                  if (p) setUnitPriceInput(p.salePrice)
                  else setUnitPriceInput('')
                }}
                placeholder="Selecione ou digite um produto avulso no campo abaixo..."
                options={produtos.map(produto => ({
                  value: produto.id,
                  label: `${produto.name} – ${produto.salePrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
                }))}
              />
              {!selectedProductId && (
                <input
                  type="text"
                  className="input-field mt-2"
                  placeholder="Nome do produto avulso..."
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                />
              )}
            </div>
          ) : (
            <div className="input-group" style={{ flex: 1, minWidth: '250px', marginBottom: 0 }}>
              <label className="input-label">Nome do Serviço</label>
              <input
                type="text"
                className="input-field"
                placeholder="Ex: Formatação, Instalação..."
                value={customName}
                onChange={e => setCustomName(e.target.value)}
              />
            </div>
          )}

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
        <h3 className="mb-4">Itens do Orçamento</h3>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Nome</th>
                <th>Qtd.</th>
                <th>Preço Unit.</th>
                <th>Subtotal</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {cart.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-muted">Nenhum item adicionado.</td>
                </tr>
              )}
              {cart.map(item => (
                <tr key={item.id}>
                  <td>
                    <span style={{ fontSize: '0.875rem', background: 'var(--bg-hover)', padding: '2px 6px', borderRadius: '4px' }}>
                      {item.isService ? 'Serviço' : 'Produto'}
                    </span>
                  </td>
                  <td>{item.name}</td>
                  <td>{item.quantity}</td>
                  <td>{item.unitPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                  <td>{(item.unitPrice * item.quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                  <td>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
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
        <h3 className="mb-4">Finalizar Orçamento</h3>
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

        <div className="flex gap-4" style={{ flexWrap: 'wrap' }}>
          <div className="input-group" style={{ flex: 1, minWidth: '200px' }}>
            <label className="input-label" htmlFor="validUntil">Validade até (opcional)</label>
            <input
              type="date"
              id="validUntil"
              name="validUntil"
              className="input-field"
              value={validUntil}
              onChange={e => setValidUntil(e.target.value)}
            />
          </div>
        </div>

        <div className="input-group">
          <label className="input-label" htmlFor="notes">Observações</label>
          <textarea
            id="notes"
            name="notes"
            className="input-field"
            rows={3}
            value={notes}
            onChange={e => setNotes(e.target.value)}
          ></textarea>
        </div>

        <input type="hidden" name="itemsJson" value={JSON.stringify(cart.map(item => ({ 
          productId: item.productId, 
          name: item.name, 
          quantity: item.quantity, 
          unitPrice: item.unitPrice, 
          isService: item.isService 
        })))} />

        <div style={{ marginTop: '2rem' }}>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.75rem' }} disabled={cart.length === 0}>
            Salvar Orçamento
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
