/**
 * Mostrado na hora ao trocar de tela, enquanto o servidor monta a página. Sem isso, o menu parece
 * travado até a consulta ao banco terminar (principalmente quando o banco "acorda" depois de parado).
 */
export default function Carregando() {
  return (
    <div role="status" aria-live="polite" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '2rem 0.5rem', color: 'var(--text-muted, #6b7280)' }}>
      <style>{`@keyframes dc-giro { to { transform: rotate(360deg) } }`}</style>
      <span style={{ width: 20, height: 20, border: '3px solid currentColor', borderRightColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'dc-giro 0.8s linear infinite' }} />
      <span>Carregando…</span>
    </div>
  )
}
