'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { iniciarEnvioAnexo, confirmarAnexo } from './anexos-actions'

interface Envio {
  nome: string
  progresso: number
  situacao: 'calculando' | 'enviando' | 'conferindo' | 'ok' | 'erro'
  erro?: string
}

/** SHA-256 do arquivo, calculado aqui no navegador antes do envio (prova de que não foi alterado). */
async function sha256(arquivo: File): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', await arquivo.arrayBuffer())
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

/** Envia direto para o Google Drive (sessão resumível), mostrando o progresso. Devolve o id do arquivo. */
function enviarParaDrive(url: string, arquivo: File, aoProgredir: (p: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', arquivo.type)
    xhr.upload.onprogress = e => { if (e.lengthComputable) aoProgredir(Math.round((e.loaded / e.total) * 100)) }
    xhr.onload = () => {
      if (xhr.status === 200 || xhr.status === 201) {
        try { resolve(JSON.parse(xhr.responseText).id) } catch { reject(new Error('Resposta inesperada do Google Drive.')) }
      } else reject(new Error(`Google Drive recusou o arquivo (${xhr.status}).`))
    }
    xhr.onerror = () => reject(new Error('A conexão caiu durante o envio. Tente de novo.'))
    xhr.send(arquivo)
  })
}

export default function EnviarAnexos({ serviceOrderId, driveConectado }: { serviceOrderId: string; driveConectado: boolean }) {
  const router = useRouter()
  const entrada = useRef<HTMLInputElement>(null)
  const [descricao, setDescricao] = useState('')
  const [envios, setEnvios] = useState<Envio[]>([])
  const ocupado = envios.some(e => e.situacao !== 'ok' && e.situacao !== 'erro')

  if (!driveConectado) {
    return (
      <p className="text-muted" style={{ fontSize: '0.85rem' }}>
        Para anexar fotos e vídeos, conecte o Google Drive em <a href="/configuracoes#google-drive" className="text-primary">Configurações → Google Drive</a>.
      </p>
    )
  }

  async function enviar(arquivos: FileList | null) {
    if (!arquivos?.length) return
    const lista = Array.from(arquivos)
    setEnvios(lista.map(a => ({ nome: a.name, progresso: 0, situacao: 'calculando' })))
    const atualizar = (i: number, dados: Partial<Envio>) => setEnvios(v => v.map((e, j) => (j === i ? { ...e, ...dados } : e)))

    for (const [i, arquivo] of lista.entries()) {
      try {
        const hash = await sha256(arquivo)
        atualizar(i, { situacao: 'enviando' })
        const inicio = await iniciarEnvioAnexo(serviceOrderId, { nome: arquivo.name, mimeType: arquivo.type, tamanho: arquivo.size })
        if (!inicio.url) throw new Error(inicio.erro || 'Não consegui iniciar o envio.')
        const driveFileId = await enviarParaDrive(inicio.url, arquivo, p => atualizar(i, { progresso: p }))
        atualizar(i, { situacao: 'conferindo', progresso: 100 })
        const r = await confirmarAnexo(serviceOrderId, { driveFileId, sha256: hash, descricao })
        if (!r.ok) throw new Error(r.erro || 'Não consegui registrar o arquivo.')
        atualizar(i, { situacao: 'ok' })
      } catch (e: any) {
        atualizar(i, { situacao: 'erro', erro: e.message })
      }
    }
    if (entrada.current) entrada.current.value = ''
    setDescricao('')
    router.refresh()
  }

  const rotulo: Record<Envio['situacao'], string> = { calculando: 'preparando…', enviando: 'enviando', conferindo: 'conferindo…', ok: 'enviado ✓', erro: 'erro' }

  return (
    <div>
      <div className="input-group" style={{ marginBottom: '0.5rem' }}>
        <label className="input-label" htmlFor="anexo-descricao">Descrição (opcional) — ex.: &quot;Estado na entrada: tela trincada no canto&quot;</label>
        <input id="anexo-descricao" className="input-field" value={descricao} onChange={e => setDescricao(e.target.value)} disabled={ocupado} maxLength={300} />
      </div>
      <input
        ref={entrada}
        type="file"
        accept="image/*,video/*"
        multiple
        disabled={ocupado}
        onChange={e => enviar(e.target.files)}
        className="input-field"
      />
      <p className="text-muted" style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
        No celular dá para tirar a foto ou gravar o vídeo na hora. Fotos e vídeos de até 2 GB.
      </p>
      {envios.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: '0.5rem 0 0', fontSize: '0.82rem' }}>
          {envios.map((e, i) => (
            <li key={i} style={{ padding: '0.25rem 0', color: e.situacao === 'erro' ? 'var(--accent-red)' : e.situacao === 'ok' ? 'var(--accent-green)' : undefined }}>
              {e.nome} — {rotulo[e.situacao]}{e.situacao === 'enviando' ? ` ${e.progresso}%` : ''}{e.erro ? `: ${e.erro}` : ''}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
