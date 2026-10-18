import type { OsAnexo } from "@prisma/client"
import EnviarAnexos from "./imprimir/EnviarAnexos"

/**
 * Quadro "Fotos e vídeos do equipamento" (tela da OS e folha de impressão). A lista com data,
 * quem enviou e o SHA-256 sai na impressão como registro de prova; o envio não.
 */
export default function FotosOS({ serviceOrderId, anexos, driveConectado }: { serviceOrderId: string; anexos: OsAnexo[]; driveConectado: boolean }) {
  const dataHora = (d: Date) => d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })
  return (
    <div id="fotos" className="print-area" style={{ marginTop: '2rem', border: '1px solid var(--border)', padding: '1rem', borderRadius: '0.5rem', scrollMarginTop: '1rem' }}>
      <h3 style={{ marginTop: 0, marginBottom: '0.75rem', fontSize: '1.125rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
        📷 Fotos e vídeos do equipamento {anexos.length > 0 && `(${anexos.length})`}
      </h3>
      {anexos.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
          {anexos.map(a => (
            <a key={a.id} href={`https://drive.google.com/file/d/${a.driveFileId}/view`} target="_blank" rel="noopener noreferrer"
              style={{ border: '1px solid var(--border)', borderRadius: '0.4rem', overflow: 'hidden', display: 'block', textDecoration: 'none', color: 'inherit' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/os/anexo/${a.id}/miniatura`} alt={a.nome} loading="lazy" style={{ width: '100%', height: '110px', objectFit: 'cover', background: 'var(--surface-hover)', display: 'block' }} />
              <div style={{ padding: '0.35rem 0.45rem', fontSize: '0.7rem', lineHeight: 1.3 }}>
                <div>{a.mimeType.startsWith('video/') ? '🎬' : '📷'} {dataHora(a.createdAt)}</div>
                {a.descricao && <div className="text-muted">{a.descricao}</div>}
              </div>
            </a>
          ))}
        </div>
      )}
      {anexos.length > 0 && (
        <details style={{ fontSize: '0.72rem', marginBottom: '0.75rem' }} className="text-muted" open>
          <summary style={{ cursor: 'pointer' }}>Registro dos arquivos (data, quem enviou e código SHA-256 de integridade)</summary>
          <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1rem', wordBreak: 'break-all' }}>
            {anexos.map(a => (
              <li key={a.id}>
                {a.nome} — {(a.tamanho / 1_048_576).toFixed(1)} MB — {a.createdAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                {a.enviadoPor && ` — por ${a.enviadoPor}`} — SHA-256 {a.sha256}
              </li>
            ))}
          </ul>
        </details>
      )}
      <div className="no-print">
        <EnviarAnexos serviceOrderId={serviceOrderId} driveConectado={driveConectado} />
      </div>
    </div>
  )
}
