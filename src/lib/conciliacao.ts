/**
 * Confere se quem pagou no extrato do banco é o cliente do lançamento.
 * - CNPJ completo no extrato: tem de ser igual ao do cliente.
 * - CPF mascarado ("•••.607.848-••"): os 6 dígitos do meio têm de bater.
 * - Sem documento: pelo menos duas palavras do nome do cliente aparecem no extrato.
 */
const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
const COMUNS = new Set(['MITRA', 'DIOCESANA', 'MARILIA', 'PAROQUIA', 'NOSSA', 'SENHORA', 'COMERCIO', 'LTDA', 'SANTA', 'SANTO'])

export function pagadorConfere(memo: string, documento: string | null | undefined, nome: string): boolean {
  const doc = (documento || '').replace(/\D/g, '')
  const cnpj = memo.match(/(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})-(\d{2})/)
  if (cnpj && doc.length === 14) return cnpj.slice(1).join('') === doc
  const cpfMascarado = memo.match(/\.(\d{3})\.(\d{3})-/)
  if (cpfMascarado && doc.length === 11) return doc.slice(3, 9) === cpfMascarado[1] + cpfMascarado[2]
  const m = normalizar(memo)
  const palavras = normalizar(nome).match(/[A-Z]{4,}/g)?.filter(p => !COMUNS.has(p)) ?? []
  return palavras.filter(p => m.includes(p)).length >= Math.min(2, palavras.length) && palavras.length > 0
}
