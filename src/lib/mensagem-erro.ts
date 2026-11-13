/** Texto de um erro capturado em `catch` (que o TypeScript trata como `unknown`). */
export function mensagemDoErro(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'string') return e
  return ''
}
