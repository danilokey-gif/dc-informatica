'use client'

import { useState } from 'react'
import Link from 'next/link'
import { registerManualEntry, processXmlUpload, salvarPrecosVenda, type ResultadoImportacao } from './actions'

type Supplier = { id: string, name: string }
type Product = { id: string, name: string, stockQty: number }

export default function EntradaClient({ suppliers, products }: { suppliers: Supplier[], products: Product[] }) {
  const [tab, setTab] = useState<'xml' | 'chave' | 'manual'>('xml')
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [precos, setPrecos] = useState<Record<string, string>>({})
  const [avisoPrecos, setAvisoPrecos] = useState<{ cor: string; texto: string } | null>(null)

  const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  /** "1.234,50" ou "1234.5" → 1234.5 */
  const lerValor = (t: string) => Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t)

  async function salvarPrecos() {
    const lista = (resultado?.itens || []).map(it => ({ produtoId: it.produtoId, preco: lerValor(precos[it.produtoId] ?? '') }))
    const r = await salvarPrecosVenda(lista)
    setAvisoPrecos(r.ok ? { cor: 'var(--accent-green)', texto: 'Preços de venda salvos.' } : { cor: 'var(--accent-red)', texto: r.erro || 'Não consegui salvar.' })
  }

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
          <div>
            <form action={async (formData) => {
              setEnviando(true)
              setResultado(null)
              try {
                const r = await processXmlUpload(formData)
                setResultado(r)
                setAvisoPrecos(null)
                // Produto já cadastrado vem com o preço atual; produto novo, em branco para você digitar.
                setPrecos(Object.fromEntries((r.itens || []).map(it => [it.produtoId, it.precoVenda > 0 ? it.precoVenda.toFixed(2).replace('.', ',') : ''])))
              } finally { setEnviando(false) }
            }}>
              <h3>Upload de XML da NF-e</h3>
              <p className="text-muted mb-4">
                Selecione o XML da nota de compra. O sistema cadastra ou atualiza os produtos (código, descrição, NCM, código de barras,
                custo com impostos e frete), o fornecedor e dá entrada no estoque. A mesma nota não entra duas vezes.
              </p>
              <div className="input-group">
                <label className="input-label">Arquivo XML</label>
                <input type="file" name="xmlFile" accept=".xml" className="input-field" required />
              </div>
              <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                <input type="checkbox" name="lancarFinanceiro" value="1" defaultChecked />
                Lançar no Financeiro (boletos da nota viram contas a pagar)
              </label>
              <button type="submit" className="btn btn-primary mt-4" disabled={enviando}>{enviando ? 'Processando…' : 'Processar XML'}</button>
            </form>

            {resultado?.error && <p style={{ color: 'var(--accent-red)', marginTop: '1rem', fontWeight: 600 }}>{resultado.error}</p>}
            {resultado?.success && (
              <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                <p style={{ color: 'var(--accent-green)', fontWeight: 600 }}>
                  NF-e nº {resultado.numero} de {resultado.fornecedor} lançada no estoque.
                  {resultado.fornecedorNovo && ' Fornecedor cadastrado.'}
                </p>
                {resultado.financeiro && <p className="text-muted" style={{ fontSize: '0.85rem' }}>{resultado.financeiro}</p>}
                <div className="table-container" style={{ marginTop: '0.75rem' }}>
                  <table className="table">
                    <thead><tr><th>Produto</th><th>Qtd.</th><th>Custo un.</th><th>Preço de venda</th><th>O que foi preenchido</th></tr></thead>
                    <tbody>
                      {resultado.itens?.map((it, i) => (
                        <tr key={i}>
                          <td>{it.nome}<div style={{ fontSize: '0.72rem', color: it.novo ? 'var(--accent-green)' : 'var(--text-muted)' }}>{it.novo ? 'Produto novo' : 'Já cadastrado: estoque somado'}</div></td>
                          <td>{it.quantidade}</td>
                          <td>{brl(it.custoUnitario)}</td>
                          <td style={{ minWidth: '140px' }}>
                            <input
                              type="text" inputMode="decimal" className="input-field" placeholder="0,00"
                              value={precos[it.produtoId] ?? ''}
                              onChange={e => setPrecos(p => ({ ...p, [it.produtoId]: e.target.value }))}
                              style={{ padding: '0.35rem 0.5rem', borderColor: !precos[it.produtoId] ? 'var(--accent-orange)' : undefined }}
                            />
                            {lerValor(precos[it.produtoId] ?? '') > 0 && it.custoUnitario > 0 && (
                              <div className="text-muted" style={{ fontSize: '0.7rem' }}>margem {Math.round((lerValor(precos[it.produtoId]) / it.custoUnitario - 1) * 100)}%</div>
                            )}
                          </td>
                          <td style={{ fontSize: '0.8rem' }}>
                            {it.preenchidos.join(', ') || '—'}
                            {it.avisos.map((a, j) => <div key={j} style={{ color: 'var(--accent-orange)' }}>{a}</div>)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex gap-4" style={{ alignItems: 'center', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-primary" onClick={salvarPrecos}>Salvar preços de venda</button>
                  {avisoPrecos && <span style={{ color: avisoPrecos.cor, fontSize: '0.85rem', fontWeight: 600 }}>{avisoPrecos.texto}</span>}
                </div>
                <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
                  Produto novo fica sem preço de venda até você digitar aqui (ou depois em <Link href="/produtos" className="text-primary">Produtos</Link>).
                </p>
              </div>
            )}
          </div>
        )}

        {tab === 'chave' && (
          <div>
            <h3>Buscar por Chave de Acesso</h3>
            <p className="text-muted mb-4">
              As notas emitidas contra o seu CNPJ chegam sozinhas da Sefaz em <Link href="/notas-fiscais/fornecedores" className="text-primary">Notas de Compra</Link>.
              Lá você dá a Ciência da Operação, baixa o XML completo e depois envia esse XML na aba &quot;Upload XML&quot;.
            </p>
            <Link href="/notas-fiscais/fornecedores" className="btn btn-primary">Abrir Notas de Compra</Link>
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
