/**
 * Tipos de lançamento do Financeiro. Só RECEITA e DESPESA são resultado da empresa (faturamento e
 * gastos). Os outros movimentam dinheiro sem ser resultado e ficam fora dos totais:
 * - APLICACAO / RESGATE: conta da empresa <-> investimento (ex.: RDB do Nubank);
 * - APORTE / RETIRADA: dinheiro do sócio que entra na empresa / que o sócio tira para si.
 */
export const TIPOS_FINANCEIRO = {
  RECEITA: { rotulo: 'Receita', cor: '#16a34a', entrada: true },
  DESPESA: { rotulo: 'Despesa', cor: '#dc2626', entrada: false },
  APLICACAO: { rotulo: 'Aplicação', cor: '#2563eb', entrada: false },
  RESGATE: { rotulo: 'Resgate', cor: '#2563eb', entrada: true },
  APORTE: { rotulo: 'Aporte do sócio', cor: '#7c3aed', entrada: true },
  RETIRADA: { rotulo: 'Retirada do sócio', cor: '#7c3aed', entrada: false },
} as const

export type TipoFinanceiro = keyof typeof TIPOS_FINANCEIRO

export const rotuloTipo = (tipo: string) => TIPOS_FINANCEIRO[tipo as TipoFinanceiro]?.rotulo ?? tipo
export const corTipo = (tipo: string) => TIPOS_FINANCEIRO[tipo as TipoFinanceiro]?.cor ?? 'inherit'

/** CPF do sócio (só números), para reconhecer transferências entre a conta dele e a da empresa. */
const CPF_SOCIO = '26408013848'

/** Quem recebe pagamentos pessoais do sócio (não são despesa da empresa). */
const PAGAMENTOS_PESSOAIS = ['SEBASTIAO EVANGELISTA']

/**
 * Classifica uma linha do extrato: aplicação/resgate de investimento e transferências do/para o
 * sócio não são receita nem despesa. O resto segue o sinal do valor.
 */
export function classificarExtrato(descricao: string, valor: number): TipoFinanceiro {
  const d = descricao.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
  if (/APLICACAO\b|APLICACAO RDB|GUARDADO NA CAIXINHA|DINHEIRO GUARDADO/.test(d)) return 'APLICACAO'
  if (/RESGATE\b|RESGATE RDB|DINHEIRO RESGATADO|RESGATADO DA CAIXINHA/.test(d)) return 'RESGATE'
  const doSocio = d.includes(CPF_SOCIO) || /DANILO CHAVES - [^0-9]*\.080\.138-/.test(d)
  // Gastos pessoais do sócio pagos pela conta da empresa (ex.: barbeiro) são retirada, não despesa.
  if (valor < 0 && PAGAMENTOS_PESSOAIS.some(n => d.includes(n))) return 'RETIRADA'
  if (doSocio) return valor >= 0 ? 'APORTE' : 'RETIRADA'
  return valor >= 0 ? 'RECEITA' : 'DESPESA'
}
