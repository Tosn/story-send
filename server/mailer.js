import nodemailer from 'nodemailer'

let transporter = null

export function isConfigured() {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS)
}

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.qq.com',
      port: Number(process.env.SMTP_PORT || 465),
      secure: true,
      pool: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    })
  }
  return transporter
}

export async function sendMail({ to, subject, text, filename, contentBase64 }) {
  const senderName = process.env.SENDER_NAME || ''
  return getTransporter().sendMail({
    from: { name: senderName, address: process.env.SMTP_USER },
    to,
    subject,
    text,
    attachments: [{ filename, content: Buffer.from(contentBase64, 'base64') }]
  })
}
