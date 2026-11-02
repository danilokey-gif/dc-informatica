/**
 * Categorias padrão do Financeiro e a regra que escolhe a categoria pela descrição do lançamento
 * (usada na importação do extrato e para organizar o que já existe sem categoria).
 */
export const CATEGORIAS_PADRAO: { nome: string; tipo: 'RECEITA' | 'DESPESA' }[] = [
  { nome: 'Serviços', tipo: 'RECEITA' },
  { nome: 'Vendas de produtos', tipo: 'RECEITA' },
  { nome: 'Recebimentos diversos', tipo: 'RECEITA' },
  { nome: 'Compras de mercadorias e peças', tipo: 'DESPESA' },
  { nome: 'Impostos e taxas', tipo: 'DESPESA' },
  { nome: 'Cartão de crédito', tipo: 'DESPESA' },
  { nome: 'Veículo', tipo: 'DESPESA' },
  { nome: 'Alimentação', tipo: 'DESPESA' },
  { nome: 'Educação e cursos', tipo: 'DESPESA' },
  { nome: 'Tarifas bancárias', tipo: 'DESPESA' },
  { nome: 'Outras despesas', tipo: 'DESPESA' },
]

const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()

/** Nome da categoria sugerida para um lançamento. */
export function categoriaSugerida(l: { type: string; description: string; notes?: string | null; paymentMethod?: string | null; saleId?: string | null; serviceOrderId?: string | null }): string | null {
  const d = sem(`${l.description} ${l.notes || ''}`)
  if (l.type === 'RECEITA') {
    if (l.saleId || /\bNF-E \d|VENDA #/.test(d)) return 'Vendas de produtos'
    if (l.serviceOrderId || /NFS-E|\bOS #|\bOS -/.test(d) || l.paymentMethod === 'NFS-e') return 'Serviços'
    return 'Recebimentos diversos'
  }
  if (l.type !== 'DESPESA') return null
  if (/\bDAS\b|SIMPLES NACIONAL|RECEITA FEDERAL|MINISTERIO DA FAZ|PREFEITURA|\bDARF\b/.test(d)) return 'Impostos e taxas'
  if (/VEICULO|LAGOINHA|POSTO |COMBUSTIV|AUTO PECAS|ESTACIONAMENTO/.test(d)) return 'Veículo'
  if (/COMPRA NF-E|MAGALU|MERCADO PAGO|MARKETPLACE|AMAZON|EBANX|SHOPEE|ALIEXPRESS|KABUM|PICHAU|TERABYTE|MERCADOLIVRE|MERCADO LIVRE|AIBR|INFORMATICA/.test(d)) return 'Compras de mercadorias e peças'
  if (/FATURA|CARTAO|DIGIO|NU PAGAMENTOS S\/A/.test(d)) return 'Cartão de crédito'
  if (/IFOOD|99 ?FOOD|RESTAURANTE|LANCHONETE|PADARIA/.test(d)) return 'Alimentação'
  if (/UNIMAR|CURSO|FACULDADE|UNIVERSIDADE|ESCOLA/.test(d)) return 'Educação e cursos'
  if (/TARIFA|JUROS|\bIOF\b|MENSALIDADE DO PACOTE/.test(d)) return 'Tarifas bancárias'
  return 'Outras despesas'
}
