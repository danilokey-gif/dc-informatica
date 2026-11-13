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

const DIA_MS = 86_400_000

/**
 * Procura, entre os lançamentos JÁ PAGOS (baixa manual, venda, OS, compra) de mesmo valor, o que o
 * extrato do banco está confirmando. Vale quem pagou conferir com o cliente; e, se não conferir
 * (ex.: o Pix veio do responsável da paróquia), vale uma baixa feita à mão na MESMA data do banco,
 * desde que seja a única candidata. Assim a baixa manual não vira um segundo lançamento.
 */
export function acharLancamentoJaPago<T extends { status: string; paymentMethod: string | null; dueDate: Date; paidDate: Date | null }>(
  candidatos: T[], dataBanco: Date, confere: (c: T) => boolean,
): T | undefined {
  // Para quem já foi pago vale a data do pagamento; a do vencimento é só a reserva.
  const dias = (c: T) => (dataBanco.getTime() - (c.paidDate ?? c.dueDate).getTime()) / DIA_MS
  const pagos = candidatos.filter(c => c.status === 'PAGO' && c.paymentMethod !== 'Transferência/Bancário' && dias(c) >= -10 && dias(c) <= 15)
  const porPagador = pagos.filter(confere).sort((a, b) => Math.abs(dias(a)) - Math.abs(dias(b)))[0]
  if (porPagador) return porPagador
  const mesmoDia = pagos.filter(c => c.paidDate && Math.abs(dias(c)) <= 1)
  return mesmoDia.length === 1 ? mesmoDia[0] : undefined
}
