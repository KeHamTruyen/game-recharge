import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

const transporter = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER && env.SMTP_PASSWORD
        ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
        : undefined,
    })
  : null;

export async function sendVerificationCode(email: string, code: string, purpose: 'register' | 'reset'): Promise<void> {
  if (!transporter || !env.MAIL_FROM) {
    throw new Error('Email delivery is not configured. Set SMTP_HOST and MAIL_FROM.');
  }

  const action = purpose === 'register' ? 'xác minh email đăng ký' : 'đặt lại mật khẩu';
  await transporter.sendMail({
    from: env.MAIL_FROM,
    to: email,
    subject: `NEXA TOPUP - Mã ${action}`,
    text: `Mã xác minh của bạn là ${code}. Mã có hiệu lực trong 10 phút và chỉ dùng một lần.`,
    html: `<p>Mã xác minh cho yêu cầu <b>${action}</b> của bạn là:</p><h2>${code}</h2><p>Mã có hiệu lực trong 10 phút và chỉ dùng một lần.</p>`,
  });
}
