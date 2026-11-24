'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { deleteCustomer } from './actions'
import BotaoExcluir from '@/components/BotaoExcluir'
import { buscarClientes, codigoCliente, ultimosCadastrados, ULTIMOS_NA_TELA } from '@/lib/cliente'

interface Customer {
  id: string
  codigo: number
  name: string
  phone: string | null
  document: string | null
  createdAt: Date
}

interface ClientesListProps {
  clientes: Customer[]
}

export default function ClientesList({ clientes }: ClientesListProps) {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState('')
  const [verTodos, setVerTodos] = useState(false)

  const buscando = !!searchTerm.trim()
  const filteredClientes = buscando ? buscarClientes(clientes, searchTerm)
    : verTodos ? clientes : ultimosCadastrados([...clientes], ULTIMOS_NA_TELA)

  return (
    <>
      {/* Campo de Busca */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <div className="input-group">
          <label className="input-label" htmlFor="search">🔍 Buscar Cliente por Código, Nome ou CPF/CNPJ</label>
          <input
            type="text"
            id="search"
            placeholder="Digite o código, o nome ou o CPF/CNPJ do cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            // Enter abre a ficha do primeiro cliente encontrado.
            onKeyDown={(e) => { if (e.key === 'Enter' && filteredClientes.length >= 1 && searchTerm.trim()) router.push(`/clientes/${filteredClientes[0].id}`) }}
            autoFocus
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

      <div className="flex justify-between items-center" style={{ flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.05rem' }}>{buscando ? 'Resultado da busca' : verTodos ? `Todos os clientes (${clientes.length})` : 'Últimos clientes cadastrados'}</h3>
        {!buscando && clientes.length > ULTIMOS_NA_TELA && (
          <button type="button" className="btn btn-outline" onClick={() => setVerTodos(v => !v)}>
            {verTodos ? 'Mostrar só os últimos' : `Mostrar todos (${clientes.length})`}
          </button>
        )}
      </div>

      {/* Tabela */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Nome</th>
              <th>Telefone</th>
              <th>Documento</th>
              <th>Cadastrado em</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredClientes.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-muted" style={{ padding: '2rem' }}>
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
                <tr key={cliente.id} onClick={() => router.push(`/clientes/${cliente.id}`)} style={{ cursor: 'pointer' }} title="Abrir a ficha do cliente">
                  <td>{codigoCliente(cliente.codigo)}</td>
                  <td><Link href={`/clientes/${cliente.id}`} className="text-primary" style={{ fontWeight: 500 }} onClick={e => e.stopPropagation()}>{cliente.name}</Link></td>
                  <td>{cliente.phone || '-'}</td>
                  <td>{cliente.document || '-'}</td>
                  <td>{new Date(cliente.createdAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</td>
                  <td>
                    <div className="flex gap-4" onClick={e => e.stopPropagation()}>
                      <Link href={`/clientes/${cliente.id}`} className="text-primary" style={{ fontWeight: 500 }}>
                        Abrir
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
