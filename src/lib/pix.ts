import QRCode from 'qrcode'

export interface PixChargeInput {
  pixKey: string
  merchantName: string
  merchantCity: string
  amount: number
  txid?: string
}

function tlv(id: string, value: string): string {
  const length = value.length.toString().padStart(2, '0')
  return `${id}${length}${value}`
}

/** CRC-16/CCITT-FALSE, exigido pelo padrão BR Code (Pix) do Banco Central. */
function crc16(payload: string): string {
  let crc = 0xffff
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) : (crc << 1)
      crc &= 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

/** Remove acentos/símbolos e limita o tamanho, conforme exigido pelos campos do BR Code. */
function sanitizeField(text: string, maxLen: number): string {
  const normalized = text
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim()
  return (normalized.slice(0, maxLen) || 'NA')
}

/**
 * Gera o payload "Pix Copia e Cola" (padrão BR Code / EMV do Banco Central).
 * Não depende de nenhum provedor externo — o valor cai direto na conta dona da chave Pix.
 */
export function gerarPixCopiaECola(input: PixChargeInput): string {
  const merchantName = sanitizeField(input.merchantName, 25)
  const merchantCity = sanitizeField(input.merchantCity, 15)
  const txid = (input.txid ? input.txid.replace(/[^a-zA-Z0-9]/g, '') : '').slice(0, 25) || '***'

  const merchantAccountInfo = tlv('00', 'br.gov.bcb.pix') + tlv('01', input.pixKey)
  const additionalData = tlv('05', txid)

  let payload =
    tlv('00', '01') +
    tlv('01', '12') +
    tlv('26', merchantAccountInfo) +
    tlv('52', '0000') +
    tlv('53', '986') +
    (input.amount > 0 ? tlv('54', input.amount.toFixed(2)) : '') +
    tlv('58', 'BR') +
    tlv('59', merchantName) +
    tlv('60', merchantCity) +
    tlv('62', additionalData)

  payload += '6304'
  return payload + crc16(payload)
}

/** Gera o QR code (data URL PNG) a partir do payload "copia e cola". */
export async function gerarPixQrCodeDataUrl(copiaECola: string): Promise<string> {
  return QRCode.toDataURL(copiaECola, { margin: 1, width: 320 })
}
