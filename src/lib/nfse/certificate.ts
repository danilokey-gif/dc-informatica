import forge from 'node-forge'
import https from 'https'

export interface CertMaterial {
  privateKeyPem: string
  certificatePem: string
  /** Data de expiração do certificado, para avisar o usuário quando estiver perto de vencer. */
  validTo: Date
  /** CN (Common Name) do certificado, geralmente contém o CNPJ/razão social. */
  commonName: string
}

/**
 * Extrai a chave privada e o certificado (em PEM) de um arquivo PFX/P12,
 * necessários para assinar o XML da DPS.
 */
export function extractCertMaterial(pfxBuffer: Buffer, password: string): CertMaterial {
  const p12Asn1 = forge.asn1.fromDer(pfxBuffer.toString('binary'))
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password)

  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })
  const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]
  if (!keyBag?.key) {
    throw new Error('Não foi possível extrair a chave privada do certificado. Verifique a senha.')
  }

  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })
  const certBag = certBags[forge.pki.oids.certBag]?.[0]
  if (!certBag?.cert) {
    throw new Error('Não foi possível extrair o certificado (.pfx). Arquivo inválido?')
  }

  const privateKeyPem = forge.pki.privateKeyToPem(keyBag.key)
  const certificatePem = forge.pki.certificateToPem(certBag.cert)
  const commonName = certBag.cert.subject.getField('CN')?.value || ''

  return {
    privateKeyPem,
    certificatePem,
    validTo: certBag.cert.validity.notAfter,
    commonName,
  }
}

/**
 * Cria um agente HTTPS com autenticação mútua (mTLS) usando o certificado,
 * necessário para chamar qualquer endpoint da API do Sistema Nacional NFS-e.
 */
export function buildMtlsAgent(pfxBuffer: Buffer, password: string): https.Agent {
  return new https.Agent({
    pfx: pfxBuffer,
    passphrase: password,
  })
}
