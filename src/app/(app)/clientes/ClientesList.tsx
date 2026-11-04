'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { deleteCustomer } from './actions'
import BotaoExcluir from '@/components/BotaoExcluir'

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

    // Sem acento e sem maiúsculas; cada palavra digitada precisa aparecer no nome, em qualquer ordem
    // ("rosa mistica" acha "MDM Paróquia Nossa Senhora Rosa Mística").
    const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    const palavras = semAcento(searchTerm).split(/\s+/).filter(Boolean)
    // Só busca por documento quando foram digitados números (senão o filtro vazio achava todo mundo).
    const digitos = searchTerm.replace(/\D/g, '')

    const filtered = clientes.filter(cliente => {
      const nome = semAcento(cliente.name)
      const nameMatch = palavras.every(p => nome.includes(p))
      const documentMatch = digitos.length >= 3 && !!cliente.document && cliente.document.replace(/\D/g, '').includes(digitos)
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
                <td colSpan={4} className="text-center text-muted" style={{ padding: '2rem' }}>
                  {searchTerm ? (
                    <div className="flex flex-col items-center gap-4">
                      <p>Nenhum cliente encontrado para &quot;{searchTerm}&quot;.</p>
                      <Link href={`/clientes/novo?nome=${encodeURIComponent(searchTerm)}`} className="btn btn-primary">
                        Cadastrar &quot;{searchTerm}&quot;
                      </Link>
                    </div>
                  ) : 'Nenhum cliente cadastrado.'}
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
                      <BotaoExcluir action={deleteAction} confirmar={`Excluir o cliente "${cliente.name}"?`} />
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
