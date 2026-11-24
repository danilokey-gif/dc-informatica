/** Código do cliente como é mostrado nas telas: 4 dígitos (0007, 0111). */
export const codigoCliente = (codigo: number) => String(codigo).padStart(4, '0')

/** Quantos clientes aparecem em "Últimos cadastrados" na tela de clientes e nas caixas de busca. */
export const ULTIMOS_NA_TELA = 10
export const ULTIMOS_NA_CAIXA = 5

/** Opção das caixas de busca de cliente (OS, venda, orçamento, contas). */
export function opcaoCliente(c: { id: string; codigo: number; name: string; document?: string | null }, comDocumento = false) {
  return {
    value: c.id,
    label: `${codigoCliente(c.codigo)} · ${c.name}${comDocumento && c.document ? ` (${c.document})` : ''}`,
    busca: c.document,
    codigo: c.codigo,
  }
}

/** Os cadastrados por último (maior código), do mais novo para o mais antigo. */
export function ultimosCadastrados<T extends { codigo?: number }>(lista: T[], quantos: number): T[] {
  return lista.filter(c => c.codigo != null).sort((a, b) => b.codigo! - a.codigo!).slice(0, quantos)
}

const semAcento = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/**
 * Busca da tela de clientes. Cada palavra digitada precisa aparecer no nome, em qualquer ordem e sem
 * ligar para acento; números (3 ou mais) procuram no CPF/CNPJ. Quando o que foi digitado é o código
 * de um cliente (ex.: "7" ou "0007"), ele aparece em primeiro.
 */
export function buscarClientes<T extends { codigo: number; name: string; document: string | null }>(clientes: T[], busca: string): T[] {
  const termo = busca.trim()
  if (!termo) return clientes
  const palavras = semAcento(termo).split(/\s+/).filter(Boolean)
  const digitos = termo.replace(/\D/g, '')
  const codigo = /^#?\d{1,6}$/.test(termo) ? Number(digitos) : null

  const peloCodigo = codigo != null ? clientes.filter(c => c.codigo === codigo) : []
  const demais = clientes.filter(c => {
    if (peloCodigo.includes(c)) return false
    const nome = semAcento(c.name)
    return palavras.every(p => nome.includes(p)) || (digitos.length >= 3 && !!c.document && c.document.replace(/\D/g, '').includes(digitos))
  })
  return [...peloCodigo, ...demais]
}
