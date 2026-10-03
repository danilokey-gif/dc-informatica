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
