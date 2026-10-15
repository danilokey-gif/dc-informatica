/** Dados de empresa devolvidos pela consulta de CNPJ do sistema (/cnpj/[cnpj]). */
export interface DadosCnpj {
  cnpj: string
  razaoSocial: string
  nomeFantasia: string
  /** Situação na Receita Federal (ATIVA, BAIXADA, INAPTA, SUSPENSA, NULA). */
  situacao: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cep: string
  municipio: string
  uf: string
  /** Código IBGE do município (7 dígitos), o que a NF-e e a NFS-e exigem. */
  codigoIbge: string | null
  telefone: string
  email: string
}

export function validarCnpj(cnpj: string): boolean {
  const d = cnpj.replace(/\D/g, '')
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false
  const digito = (base: string) => {
    let soma = 0, peso = base.length - 7
    for (const c of base) { soma += Number(c) * peso--; if (peso < 2) peso = 9 }
    const r = soma % 11
    return r < 2 ? 0 : 11 - r
  }
  return digito(d.slice(0, 12)) === Number(d[12]) && digito(d.slice(0, 13)) === Number(d[13])
}

/** Consulta o CNPJ pelo próprio sistema. Devolve os dados ou uma mensagem de erro pronta para mostrar. */
export async function consultarCnpj(cnpj: string): Promise<DadosCnpj | { erro: string }> {
  try {
    const r = await fetch(`/cnpj/${cnpj.replace(/\D/g, '')}`)
    const dados = await r.json()
    return r.ok ? (dados as DadosCnpj) : { erro: dados.erro || 'Não consegui consultar o CNPJ.' }
  } catch {
    return { erro: 'Não consegui consultar o CNPJ. Preencha os dados à mão.' }
  }
}

/** Dados de uma pessoa/empresa achados nas notas já emitidas pelo sistema (/documento/[doc]). */
export interface DadosDocumento {
  /** De onde veio (ex.: "NFS-e de 28/09/2026"). */
  origem: string
  nome: string
  telefone: string
  email: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cep: string
  municipio: string
  uf: string
  codigoIbge: string | null
}

export interface ResultadoDocumento {
  /** Cliente já cadastrado com esse CPF/CNPJ. */
  cliente: { id: string; name: string } | null
  dados: DadosDocumento | null
}

/** Procura o CPF/CNPJ nos clientes e nas notas já emitidas. Em caso de falha devolve "nada achado". */
export async function consultarDocumentoInterno(doc: string): Promise<ResultadoDocumento> {
  try {
    const r = await fetch(`/documento/${doc.replace(/\D/g, '')}`)
    if (r.ok) return await r.json()
  } catch { /* segue sem */ }
  return { cliente: null, dados: null }
}
