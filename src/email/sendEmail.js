import nodemailer from 'nodemailer';
import { logger } from '../utils/logger.js';

export function resolveSmtp(config) {
  const provider = String(config.email.provider || 'auto').toLowerCase();
  const user = String(config.email.user || '').toLowerCase();
  if (provider === 'qq' || (provider === 'auto' && user.endsWith('@qq.com'))) {
    return { provider: 'QQ', host: 'smtp.qq.com', port: 465, secure: true };
  }
  if (provider === 'gmail' || (provider === 'auto' && user.endsWith('@gmail.com'))) {
    return { provider: 'Gmail', host: 'smtp.gmail.com', port: 465, secure: true };
  }
  throw new Error('无法自动识别发件邮箱。目前支持 QQ 邮箱和 Gmail；请设置 EMAIL_PROVIDER=qq 或 gmail');
}

export async function sendEmail({ config, subject, html, text, createTransport = nodemailer.createTransport }) {
  const smtp = resolveSmtp(config);
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const transporter = createTransport({
      host: smtp.host, port: smtp.port, secure: smtp.secure,
      auth: { user: config.email.user, pass: config.email.password },
      connectionTimeout: 20_000, greetingTimeout: 15_000, socketTimeout: 30_000
    });
    try {
      if (typeof transporter.verify === 'function') await transporter.verify();
      const info = await transporter.sendMail({ from: `全球新闻日报 <${config.email.user}>`, to: config.email.to.join(', '), subject, html, text });
      logger.info(`邮件已由 ${smtp.provider} SMTP 接受`, { messageId: info.messageId || 'accepted', accepted: info.accepted?.length || 0, rejected: info.rejected?.length || 0, testMode: Boolean(config.email.testMode) });
      return info;
    } catch (error) {
      lastError = error; logger.error('邮件发送失败', { attempt, code: error.code, command: error.command, responseCode: error.responseCode, message: error.message });
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 1000 * (2 ** (attempt - 1))));
    } finally { if (typeof transporter.close === 'function') transporter.close(); }
  }
  throw lastError;
}
