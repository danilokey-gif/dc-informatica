/**
 * Início do dia atual em UTC-midnight, consistente com o formato usado ao salvar
 * campos de data (inputs type="date" geram "AAAA-MM-DD", que o JS interpreta como
 * meia-noite UTC ao converter para Date). Usar isso evita que uma conta com
 * vencimento "hoje" apareça como atrasada por causa do fuso horário do servidor.
 */
export function inicioDoDiaUTC(): Date {
  return new Date(new Date().toISOString().slice(0, 10))
}

/**
 * Formata uma data "pura" (sem hora, ex: vencimento) em pt-BR usando UTC,
 * para não deslocar um dia por causa do fuso horário do navegador/servidor.
 */
export function formatarDataUTC(data: Date | string): string {
  return new Date(data).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}
