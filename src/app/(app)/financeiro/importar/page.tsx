'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { parseOfx, OfxTransaction } from '@/lib/ofx-parser'
import { salvarTransacoesImportadas, buscarCategoriasFinanceiras } from './actions'

interface ImportItem extends OfxTransaction {
  selected: boolean
  categoryId: string
}

export default function ImportarExtratoPage() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [transactions, setTransactions] = useState<ImportItem[]>([])
  const [categories, setCategories] = useState<{ id: string, name: string, type: string }[]>([])
  const [isParsing, setIsParsing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    buscarCategoriasFinanceiras().then(setCategories).catch(console.error)
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) {
      setFile(selected)
      setError(null)
    }
  }

  const handleParse = async () => {
    if (!file) return
    setIsParsing(true)
    setError(null)
    
    try {
      const text = await file.text()
      const parsed = parseOfx(text)
      
      if (parsed.length === 0) {
        setError('Nenhuma transação encontrada no arquivo. Verifique se é um arquivo OFX válido.')
        setTransactions([])
        return
      }

      setTransactions(parsed.map(t => ({
        ...t,
        selected: true,
        categoryId: '',
      })))
    } catch (err: any) {
      setError(err.message || 'Erro ao ler arquivo OFX.')
    } finally {
      setIsParsing(false)
    }
  }

  const toggleSelect = (id: string) => {
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, selected: !t.selected } : t))
  }

  const toggleSelectAll = (checked: boolean) => {
    setTransactions(prev => prev.map(t => ({ ...t, selected: checked })))
  }

  const handleCategoryChange = (id: string, categoryId: string) => {
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, categoryId } : t))
  }

  const handleSave = async () => {
    const selected = transactions.filter(t => t.selected)
    if (selected.length === 0) {
      setError('Selecione pelo menos uma transação para importar.')
      return
    }

    setIsSaving(true)
    setError(null)
    
    try {
      const payload = selected.map(t => ({
        description: t.description,
        amount: t.amount,
        date: t.date.toISOString(),
        type: t.amount >= 0 ? 'RECEITA' as const : 'DESPESA' as const,
        categoryId: t.categoryId || undefined,
        notes: t.id, // salvar o id original como nota pra referencia
      }))

      const res = await salvarTransacoesImportadas(payload)
      if (res.error) {
        setError(res.error)
      } else {
        alert(`${res.count} transações importadas com sucesso!`)
        router.push('/financeiro')
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar transações.')
    } finally {
      setIsSaving(false)
    }
  }

  const totalSelecionado = transactions.filter(t => t.selected).length
  const saldoSelecionado = transactions.filter(t => t.selected).reduce((acc, t) => acc + t.amount, 0)

  return (
    <div className="animate-fade-in max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2>Importar Extrato OFX</h2>
          <p className="text-muted">Importe seu extrato bancário para conciliar entradas e saídas no financeiro.</p>
        </div>
        <Link href="/financeiro" className="btn btn-outline">Cancelar</Link>
      </div>

      <div className="card mb-6">
        <h3 className="mb-4">1. Envie o Arquivo</h3>
        <div className="flex gap-4 items-center">
          <input 
            type="file" 
            accept=".ofx" 
            onChange={handleFileChange}
            className="input-field"
            style={{ maxWidth: '300px' }}
          />
          <button 
            className="btn btn-primary" 
            onClick={handleParse} 
            disabled={!file || isParsing}
          >
            {isParsing ? 'Lendo...' : 'Ler Extrato'}
          </button>
        </div>
        {error && <p className="text-accent-red mt-4">{error}</p>}
      </div>

      {transactions.length > 0 && (
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h3 className="m-0">2. Revise e Categorize</h3>
            <div className="text-right">
              <p className="m-0 text-sm font-semibold text-muted">{totalSelecionado} selecionadas</p>
              <p className={`m-0 font-bold ${saldoSelecionado >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                Balanço: {saldoSelecionado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>
          </div>

          <div className="table-container mb-6" style={{ maxHeight: '500px', overflowY: 'auto' }}>
            <table className="table" style={{ fontSize: '0.85rem' }}>
              <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-card)', zIndex: 10 }}>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>
                    <input 
                      type="checkbox" 
                      checked={transactions.length > 0 && transactions.every(t => t.selected)}
                      onChange={(e) => toggleSelectAll(e.target.checked)}
                    />
                  </th>
                  <th>Data</th>
                  <th>Descrição (Extrato)</th>
                  <th>Valor</th>
                  <th>Categoria</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(t => {
                  const isReceita = t.amount >= 0
                  const availableCategories = categories.filter(c => c.type === (isReceita ? 'RECEITA' : 'DESPESA'))
                  return (
                    <tr key={t.id} style={{ opacity: t.selected ? 1 : 0.5 }}>
                      <td style={{ textAlign: 'center' }}>
                        <input 
                          type="checkbox" 
                          checked={t.selected}
                          onChange={() => toggleSelect(t.id)}
                        />
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>{t.date.toLocaleDateString('pt-BR')}</td>
                      <td>{t.description}</td>
                      <td style={{ color: isReceita ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                        {t.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td>
                        <select 
                          className="input-field" 
                          style={{ padding: '0.2rem 0.5rem', height: 'auto', minWidth: '150px' }}
                          value={t.categoryId}
                          onChange={(e) => handleCategoryChange(t.id, e.target.value)}
                          disabled={!t.selected}
                        >
                          <option value="">-- Sem Categoria --</option>
                          {availableCategories.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <button 
              className="btn btn-primary" 
              onClick={handleSave}
              disabled={isSaving || totalSelecionado === 0}
            >
              {isSaving ? 'Salvando...' : 'Importar Selecionadas'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
