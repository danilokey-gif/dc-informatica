import nodemailer from 'nodemailer'

function getTransporter() {
  const user = process.env.GMAIL_USER
  const pass = process.env.GMAIL_APP_PASSWORD
  if (!user || !pass) {
    throw new Error('Envio de e-mail não configurado (GMAIL_USER/GMAIL_APP_PASSWORD ausentes).')
  }
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  })
}

interface AnexoArquivo {
  filename: string
  content: string | Buffer
  contentType?: string
}

export async function enviarEmail(params: { to: string; subject: string; html: string; logoDataUrl?: string | null; arquivos?: AnexoArquivo[] }) {
  const transporter = getTransporter()

  const attachments: Array<{ filename: string; content: string | Buffer; cid?: string; contentType?: string }> = (params.arquivos || []).map(a => ({
    filename: a.filename,
    content: a.content,
    contentType: a.contentType,
  }))
  let htmlComLogo = params.html
  if (params.logoDataUrl) {
    const match = params.logoDataUrl.match(/^data:(image\/[a-z+]+);base64,(.+)$/)
    if (match) {
      attachments.push({
        filename: 'logo.png',
        content: Buffer.from(match[2], 'base64'),
        cid: 'logo-empresa',
      })
      htmlComLogo = `<img src="cid:logo-empresa" alt="Logo" style="height:60px;width:60px;object-fit:contain;margin-bottom:1rem;" />${params.html}`
    }
  }

  await transporter.sendMail({
    from: `"${process.env.EMAIL_REMETENTE_NOME || 'Dc Informática'}" <${process.env.GMAIL_USER}>`,
    to: params.to,
    subject: params.subject,
    html: htmlComLogo,
    attachments,
  })
}
