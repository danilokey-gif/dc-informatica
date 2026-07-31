'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { deleteCustomer } from './actions'

interface Customer {
  id: string
  name: string
  phone: string | null
  document: string | null
  createdAt: Date
}

interface ClientesListProps {
  clientes: Customer[]
}

export default function ClientesList({ clientes }: ClientesListProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [filteredClientes, setFilteredClientes] = useState<Customer[]>(clientes)

  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredClientes(clientes)
      return
    }

    const term = searchTerm.toLowerCase().replace(/\D/g, '')
    
    const filtered = clientes.filter(cliente => {
      const nameMatch = cliente.name.toLowerCase().includes(searchTerm.toLowerCase())
      const documentMatch = cliente.document 
        ? cliente.document.replace(/\D/g, '').includes(term) 
        : false
      
      return nameMatch || documentMatch
    })

    setFilteredClientes(filtered)
  }, [searchTerm, clientes])

  return (
    <>
      {/* Campo de Busca */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <div className="input-group">
          <label className="input-label" htmlFor="search">🔍 Buscar Cliente por Nome ou CPF/CNPJ</label>
          <input
            type="text"
            id="search"
            placeholder="Digite o nome ou CPF/CNPJ do cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field"
            style={{ fontSize: '1rem', padding: '0.75rem' }}
          />
          {searchTerm && (
            <p className="text-muted" style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
              📊 Encontrado{filteredClientes.length !== 1 ? 's' : ''}: <strong>{filteredClientes.length}</strong> cliente{filteredClientes.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>

      {/* Tabela */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Telefone</th>
              <th>Documento</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredClientes.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center text-muted">
                  {searchTerm ? `Nenhum cliente encontrado para "${searchTerm}"` : 'Nenhum cliente cadastrado.'}
                </td>
              </tr>
            )}
            {filteredClientes.map(cliente => {
              const deleteAction = deleteCustomer.bind(null, cliente.id)
              return (
                <tr key={cliente.id}>
                  <td>{cliente.name}</td>
                  <td>{cliente.phone || '-'}</td>
                  <td>{cliente.document || '-'}</td>
                  <td>
                    <div className="flex gap-4">
                      <Link href={`/clientes/${cliente.id}`} className="text-primary" style={{ fontWeight: 500 }}>
                        Editar
                      </Link>
                      <form action={deleteAction} style={{ display: 'inline' }}>
                        <button
                          type="submit"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            fontWeight: 500
                          }}
                        >
                          Excluir
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
