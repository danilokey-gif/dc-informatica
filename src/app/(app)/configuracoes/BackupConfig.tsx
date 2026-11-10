import { fazerBackupAgora } from "./actions"
import BotaoBackup from "./BotaoBackup"

/** Backup do banco de dados: situação do último, botão para fazer agora e para baixar. */
export default function BackupConfig({ driveConectado, ultimoEm, ultimoResultado, ultimoOk }: {
  driveConectado: boolean; ultimoEm: Date | null; ultimoResultado: string | null; ultimoOk: boolean | null
}) {
  const horas = ultimoEm ? (Date.now() - ultimoEm.getTime()) / 3600_000 : null
  // O automático roda toda madrugada; mais de 2 dias sem backup bom merece aviso.
  const atrasado = !ultimoEm || ultimoOk === false || (horas !== null && horas > 48)

  return (
    <div id="backup" className="card mb-4" style={{ borderLeft: `4px solid ${atrasado ? 'var(--accent-orange)' : 'var(--accent-green)'}`, scrollMarginTop: '1rem' }}>
      <h3 className="mb-4">💾 Backup do banco de dados</h3>
      <p className="text-muted" style={{ fontSize: '0.85rem' }}>
        Toda madrugada o sistema salva uma cópia completa (clientes, OS, vendas, produtos, financeiro, notas e configurações)
        na pasta &quot;Dc Informática - Sistema / Backups&quot; do seu Google Drive. Ficam guardados os últimos 30 dias e o
        backup do dia 1º de cada mês por um ano. Fotos e vídeos das OS já ficam no próprio Drive.
      </p>

      {!driveConectado && (
        <p style={{ color: 'var(--accent-orange)', fontWeight: 600, fontSize: '0.9rem' }}>
          O Google Drive não está conectado, então o backup automático não roda. Conecte no quadro acima ou baixe o backup manualmente.
        </p>
      )}

      <p style={{ fontSize: '0.9rem', margin: '0.75rem 0' }}>
        Último backup:{' '}
        {ultimoEm ? (
          <strong style={{ color: ultimoOk ? 'var(--accent-green)' : 'var(--accent-red)' }}>
            {ultimoEm.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })}
            {ultimoOk ? '' : ' — falhou'}
          </strong>
        ) : <strong style={{ color: 'var(--accent-orange)' }}>nenhum ainda</strong>}
      </p>
      {ultimoResultado && <p className="text-muted" style={{ fontSize: '0.8rem' }}>{ultimoResultado}</p>}
      {ultimoEm && ultimoOk && horas !== null && horas > 48 && (
        <p style={{ color: 'var(--accent-orange)', fontWeight: 600, fontSize: '0.85rem' }}>
          Faz mais de 2 dias que o backup automático não roda. Clique em &quot;Fazer backup agora&quot; e, se repetir, me avise.
        </p>
      )}

      <div className="flex gap-4" style={{ marginTop: '1rem', flexWrap: 'wrap' }}>
        {driveConectado && <form action={fazerBackupAgora}><BotaoBackup /></form>}
        <a href="/configuracoes/backup" className="btn btn-outline" download>Baixar backup para o computador</a>
      </div>
    </div>
  )
}
