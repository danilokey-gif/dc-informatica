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

export async function enviarEmail(params: { to: string; subject: string; html: string }) {
  const transporter = getTransporter()
  await transporter.sendMail({
    from: `"${process.env.EMAIL_REMETENTE_NOME || 'Dc Informática'}" <${process.env.GMAIL_USER}>`,
    to: params.to,
    subject: params.subject,
    html: params.html,
  })
}
