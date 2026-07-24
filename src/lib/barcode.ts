import bwipjs from 'bwip-js/node'

/** Gera um código de barras Code128 (padrão da chave de acesso de NF-e/NFS-e) como data URL PNG. */
export async function gerarCode128DataUrl(texto: string): Promise<string> {
  const buffer = await bwipjs.toBuffer({
    bcid: 'code128',
    text: texto,
    scale: 2,
    height: 12,
    includetext: false,
    backgroundcolor: 'FFFFFF',
  })
  return `data:image/png;base64,${buffer.toString('base64')}`
}
