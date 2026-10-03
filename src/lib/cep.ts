/** Endereço devolvido pela consulta de CEP do sistema (/cep/[cep]). */
export interface EnderecoCep {
  cep: string
  logradouro: string
  bairro: string
  municipio: string
  uf: string
  /** Código IBGE do município (7 dígitos), o que a NF-e e a NFS-e exigem. */
  codigoIbge: string | null
}
