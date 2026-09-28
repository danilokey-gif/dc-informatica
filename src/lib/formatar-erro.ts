/**
 * Transforma um erro em texto legível, incluindo a cadeia de `cause` (é nela que o Node coloca o
 * motivo real de falhas de rede/TLS, como "unable to get local issuer certificate").
 */
export function formatarErro(error: unknown): string {
  if (!(error instanceof Error)) return String(error)
  const partes = [`${error.name}: ${error.message}`]
  let causa = (error as { cause?: unknown }).cause
  while (causa) {
    if (causa instanceof Error) {
      partes.push(`causa: ${causa.name}: ${causa.message}`)
      causa = (causa as { cause?: unknown }).cause
    } else {
      partes.push(`causa: ${String(causa)}`)
      break
    }
  }
  return partes.join(' | ')
}
