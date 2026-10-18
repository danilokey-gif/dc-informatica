'use client'

/** Partes do envio: múltiplo de 256 KiB, como o Google exige no upload resumível. */
const PARTE = 4 * 1024 * 1024

/**
 * SHA-256 do arquivo, calculado aqui no navegador antes do envio (prova de que não foi alterado).
 * Lê em partes, então vídeos grandes não estouram a memória e dá para mostrar o andamento.
 */
export async function sha256(arquivo: File, aoProgredir: (p: number) => void): Promise<string> {
  const { createSHA256 } = await import('hash-wasm')
  const hasher = await createSHA256()
  hasher.init()
  for (let inicio = 0; inicio < arquivo.size; inicio += PARTE) {
    hasher.update(new Uint8Array(await arquivo.slice(inicio, inicio + PARTE).arrayBuffer()))
    aoProgredir(Math.round((Math.min(arquivo.size, inicio + PARTE) / arquivo.size) * 100))
  }
  return hasher.digest('hex')
}

/** Uma parte do arquivo; resolve com o id do arquivo na última parte, ou null nas intermediárias. */
function enviarParte(url: string, arquivo: File, inicio: number, aoProgredir: (bytes: number) => void): Promise<string | null> {
  const fim = Math.min(arquivo.size, inicio + PARTE)
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Range', `bytes ${inicio}-${fim - 1}/${arquivo.size}`)
    xhr.upload.onprogress = e => aoProgredir(inicio + e.loaded)
    xhr.onload = () => {
      if (xhr.status === 308) return resolve(null) // parte recebida, faltam outras
      if (xhr.status === 200 || xhr.status === 201) {
        try { return resolve(JSON.parse(xhr.responseText).id) } catch { return reject(new Error('Resposta inesperada do Google Drive.')) }
      }
      reject(new Error(`Google Drive recusou o arquivo (${xhr.status}).`))
    }
    xhr.onerror = () => reject(new Error('A conexão caiu durante o envio. Tente de novo.'))
    xhr.send(arquivo.slice(inicio, fim))
  })
}

/**
 * Envia direto para o Google Drive em partes de 4 MB (upload resumível). A porcentagem só avança
 * conforme o Google confirma cada parte, então é o andamento real. Devolve o id do arquivo.
 */
export async function enviarParaDrive(url: string, arquivo: File, aoProgredir: (p: number) => void): Promise<string> {
  const pct = (bytes: number) => aoProgredir(Math.min(99, Math.round((bytes / arquivo.size) * 100)))
  for (let inicio = 0; inicio < arquivo.size; inicio += PARTE) {
    const id = await enviarParte(url, arquivo, inicio, pct)
    pct(Math.min(arquivo.size, inicio + PARTE))
    if (id) return id
  }
  throw new Error('O Google Drive não confirmou o fim do envio.')
}

