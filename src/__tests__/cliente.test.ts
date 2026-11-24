import { describe, it, expect } from 'vitest'
import { codigoCliente, opcaoCliente, ultimosCadastrados, buscarClientes } from '@/lib/cliente'

// Clientes fictícios.
const clientes = [
  { id: 'a', codigo: 1, name: 'Paróquia São Exemplo', document: '11.222.333/0001-81' },
  { id: 'b', codigo: 7, name: 'Maria Teste', document: null },
  { id: 'c', codigo: 112, name: 'João Modelo', document: '123.456.789-09' },
]

describe('código do cliente', () => {
  it('mostra com 4 dígitos e entra no rótulo das caixas de busca', () => {
    expect(codigoCliente(7)).toBe('0007')
    expect(opcaoCliente(clientes[1]).label).toBe('0007 · Maria Teste')
    expect(opcaoCliente(clientes[2], true).label).toBe('0112 · João Modelo (123.456.789-09)')
  })

  it('últimos cadastrados vêm do mais novo para o mais antigo', () => {
    expect(ultimosCadastrados(clientes, 2).map(c => c.id)).toEqual(['c', 'b'])
  })

  it('busca pelo código, com ou sem zeros, e traz o código exato primeiro', () => {
    expect(buscarClientes(clientes, '7')[0].id).toBe('b')
    expect(buscarClientes(clientes, '0007')[0].id).toBe('b')
    expect(buscarClientes(clientes, '112')[0].id).toBe('c') // também aparece 11.222 no CNPJ, depois
  })

  it('continua achando por nome sem acento e por documento', () => {
    expect(buscarClientes(clientes, 'paroquia exemplo').map(c => c.id)).toEqual(['a'])
    expect(buscarClientes(clientes, '456.789').map(c => c.id)).toEqual(['c'])
    expect(buscarClientes(clientes, '')).toHaveLength(3)
  })
})
