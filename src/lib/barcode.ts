import bwipjs from 'bwip-js/node'

/** Gera um código de barras Code128 (padrão da chave de acesso de NF-e/NFS-e) como buffer PNG. */
export async function gerarCode128Buffer(texto: string): Promise<Buffer> {
  return bwipjs.toBuffer({
    bcid: 'code128',
    text: texto,
    scale: 2,
    height: 12,
    includetext: false,
    backgroundcolor: 'FFFFFF',
  })
}

/** Gera um código de barras Code128 como data URL PNG (para uso em <img> no HTML). */
export async function gerarCode128DataUrl(texto: string): Promise<string> {
  const buffer = await gerarCode128Buffer(texto)
  return `data:image/png;base64,${buffer.toString('base64')}`
}
