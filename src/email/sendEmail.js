import nodemailer from 'nodemailer';
import { logger } from '../utils/logger.js';

export async function sendEmail({ config, subject, html, text, createTransport = nodemailer.createTransport }) {
  const transporter = createTransport({ service: 'gmail', auth: { user: config.email.user, pass: config.email.password }, pool: true, maxConnections: 1 });
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try { return await transporter.sendMail({ from: `全球新闻日报 <${config.email.user}>`, to: config.email.to.join(', '), subject, html, text }); }
    catch (error) { lastError = error; logger.error('邮件发送失败', { attempt, code: error.code, message: error.message }); if (attempt < 3) await new Promise((r) => setTimeout(r, 500 * (2 ** (attempt - 1)))); }
  }
  throw lastError;
}
