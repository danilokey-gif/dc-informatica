/**
 * Confere o dígito verificador GS1 de um GTIN-8/12/13/14 (código de barras). Um GTIN com dígito
 * errado faz a Sefaz recusar a NF-e (regra I03-10, erro 611 — NT 2021.003).
 */
export function gtinValido(gtin: string): boolean {
  if (!/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(gtin)) return false
  const digitos = gtin.split('').map(Number)
  const verificador = digitos.pop()!
  // Da direita para a esquerda, a partir do dígito ao lado do verificador: pesos 3, 1, 3, 1...
  const soma = digitos.reverse().reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0)
  return (10 - (soma % 10)) % 10 === verificador
}
