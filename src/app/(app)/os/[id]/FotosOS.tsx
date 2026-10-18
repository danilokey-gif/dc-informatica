import type { OsAnexo } from "@prisma/client"
import EnviarAnexos from "./imprimir/EnviarAnexos"
import GaleriaAnexos from "./GaleriaAnexos"

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
        <GaleriaAnexos anexos={anexos.map(a => ({
          id: a.id, driveFileId: a.driveFileId, nome: a.nome, video: a.mimeType.startsWith('video/'), quando: dataHora(a.createdAt), descricao: a.descricao,
        }))} />
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
