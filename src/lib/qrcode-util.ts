import QRCode from 'qrcode'

/** Gera um QR Code genérico (data URL PNG) a partir de um texto/URL qualquer. */
export async function gerarQrCodeDataUrl(texto: string): Promise<string> {
  return QRCode.toDataURL(texto, { margin: 1, width: 240 })
}

/** Gera um QR Code genérico como buffer PNG (para embutir em PDF). */
export async function gerarQrCodeBuffer(texto: string): Promise<Buffer> {
  return QRCode.toBuffer(texto, { margin: 1, width: 240 })
}
