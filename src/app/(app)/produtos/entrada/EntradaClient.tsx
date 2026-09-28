'use client'

import { useState } from 'react'
import { registerManualEntry, processXmlUpload } from './actions'

type Supplier = { id: string, name: string }
type Product = { id: string, name: string, stockQty: number }

export default function EntradaClient({ suppliers, products }: { suppliers: Supplier[], products: Product[] }) {
  const [tab, setTab] = useState<'xml' | 'chave' | 'manual'>('xml')

  // Manual entry state
  const [selectedSupplier, setSelectedSupplier] = useState('')
  const [items, setItems] = useState<{ productId: string, quantity: number, unitCost: number }[]>([])
  
  const [selectedProduct, setSelectedProduct] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [unitCost, setUnitCost] = useState(0)

  const addItem = () => {
    if (!selectedProduct || quantity <= 0) return
    setItems([...items, { productId: selectedProduct, quantity, unitCost }])
    setSelectedProduct('')
    setQuantity(1)
    setUnitCost(0)
  }

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (items.length === 0) return alert('Adicione pelo menos um produto.')
    
    const formData = new FormData()
    if (selectedSupplier) formData.append('supplierId', selectedSupplier)
    formData.append('items', JSON.stringify(items))
    
    await registerManualEntry(formData)
  }

  return (
    <div className="animate-fade-in">
      <h2>Entrada de Compras</h2>
      
      <div className="flex gap-4 mb-4 mt-4">
        <button 
          className={`btn ${tab === 'xml' ? 'btn-primary' : ''}`}
          onClick={() => setTab('xml')}
        >
          Upload XML
        </button>
        <button 
          className={`btn ${tab === 'chave' ? 'btn-primary' : ''}`}
          onClick={() => setTab('chave')}
        >
          Chave de Acesso
        </button>
        <button 
          className={`btn ${tab === 'manual' ? 'btn-primary' : ''}`}
          onClick={() => setTab('manual')}
        >
          Entrada Manual
        </button>
      </div>

      <div className="card">
        {tab === 'xml' && (
          <form action={async (formData) => {
            const res = await processXmlUpload(formData)
            if (res.error) alert(res.error)
            else {
              alert('Produtos atualizados com sucesso no estoque!')
              setTab('manual')
            }
          }}>
            <h3>Upload de XML da NFe</h3>
            <p className="text-muted mb-4">Selecione o arquivo XML da nota fiscal para importar os produtos.</p>
            <div className="input-group">
              <label>Arquivo XML</label>
              <input type="file" name="xmlFile" accept=".xml" className="input-field" required />
            </div>
            <button type="submit" className="btn btn-primary mt-4">Processar XML</button>
          </form>
        )}

        {tab === 'chave' && (
          <div>
            <h3>Buscar por Chave de Acesso</h3>
            <p className="text-muted mb-4">Digite a chave de 44 dígitos para baixar o XML via Sefaz.</p>
            <div className="input-group">
              <label>Chave de Acesso</label>
              <input type="text" maxLength={44} className="input-field" placeholder="Ex: 352301... (44 dígitos)" />
            </div>
            <button className="btn btn-primary mt-4">Consultar Sefaz</button>
          </div>
        )}

        {tab === 'manual' && (
          <form onSubmit={handleManualSubmit}>
            <h3>Entrada Manual</h3>
            <p className="text-muted mb-4">Registre a entrada de produtos manualmente.</p>
            
            <div className="input-group mb-4">
              <label>Fornecedor (Opcional)</label>
              <select 
                className="input-field" 
                value={selectedSupplier}
                onChange={e => setSelectedSupplier(e.target.value)}
              >
                <option value="">Selecione um fornecedor</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div className="card mb-4" style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <h4>Adicionar Produto</h4>
              <div className="flex gap-4 items-end mt-2">
                <div className="input-group flex-1">
                  <label>Produto</label>
                  <select 
                    className="input-field"
                    value={selectedProduct}
                    onChange={e => setSelectedProduct(e.target.value)}
                  >
                    <option value="">Selecione...</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name} (Estoque: {p.stockQty})</option>
                    ))}
                  </select>
                </div>
                <div className="input-group w-32">
                  <label>Qtd</label>
                  <input 
                    type="number" 
                    min="1"
                    className="input-field" 
                    value={quantity}
                    onChange={e => setQuantity(parseInt(e.target.value) || 1)}
                  />
                </div>
                <div className="input-group w-32">
                  <label>Custo Unit.</label>
                  <input 
                    type="number" 
                    step="0.01"
                    min="0"
                    className="input-field" 
                    value={unitCost}
                    onChange={e => setUnitCost(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <button type="button" className="btn btn-primary mb-1" onClick={addItem}>Adicionar</button>
              </div>
            </div>

            {items.length > 0 && (
              <div className="table-container mb-4">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Produto</th>
                      <th>Qtd</th>
                      <th>Custo Unit.</th>
                      <th>Total</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => {
                      const prod = products.find(p => p.id === item.productId)
                      return (
                        <tr key={idx}>
                          <td>{prod?.name}</td>
                          <td>{item.quantity}</td>
                          <td>{item.unitCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                          <td>{(item.quantity * item.unitCost).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                          <td>
                            <button type="button" onClick={() => removeItem(idx)} style={{ color: 'red', background: 'none', border: 'none', cursor: 'pointer' }}>Remover</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <button type="submit" className="btn btn-primary" disabled={items.length === 0}>
              Salvar Entrada
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
