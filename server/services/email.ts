
import nodemailer from 'nodemailer';
import { User } from '@shared/schema';

// Configurar o transportador de email
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

export const sendPasswordResetEmail = async (user: User, resetToken: string) => {
  const resetLink = `${process.env.APP_URL || 'http://localhost:5000'}/reset-password?token=${resetToken}`;
  
  const mailOptions = {
    from: process.env.SMTP_FROM || 'noreply@consultapsi.com',
    to: user.email,
    subject: 'Recuperação de Senha - ConsultaPsi',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0097FB;">ConsultaPsi - Recuperação de Senha</h2>
        <p>Olá ${user.fullName},</p>
        <p>Recebemos uma solicitação para redefinir sua senha. Se você não fez esta solicitação, por favor ignore este email.</p>
        <p>Para redefinir sua senha, clique no botão abaixo:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" 
             style="background-color: #0097FB; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 4px; display: inline-block;">
            Redefinir Senha
          </a>
        </div>
        <p>Este link é válido por 1 hora.</p>
        <p>Se o botão não funcionar, copie e cole o link abaixo no seu navegador:</p>
        <p style="word-break: break-all;">${resetLink}</p>
        <hr style="margin: 30px 0; border: 1px solid #eee;">
        <p style="color: #666; font-size: 12px;">
          Este é um email automático, por favor não responda.
        </p>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
};
