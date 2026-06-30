import nodemailer from 'nodemailer';
import { config } from '../config/env.js';

// True when the platform system mailbox is configured (used for system emails
// like the password-change verification code).
export const systemMailReady = () =>
  !!(config.systemMail.host && config.systemMail.user && config.systemMail.pass);

// Sends a system email from the platform mailbox (NOT a shop's marketing SMTP).
export const sendSystemMail = async (to, subject, body) => {
  if (!to) throw new Error('No email address');
  if (!systemMailReady()) throw new Error('System email is not configured on the server');
  const m = config.systemMail;
  const transport = nodemailer.createTransport({
    host: m.host,
    port: Number(m.port) || 587,
    secure: !!m.secure,
    auth: { user: m.user, pass: m.pass },
  });
  const from = m.from || (m.fromName ? `"${m.fromName}" <${m.user}>` : m.user);
  return transport.sendMail({ from, to, subject, text: body, html: body.replace(/\n/g, '<br>') });
};

// Builds a nodemailer transport from the shop owner's own SMTP credentials.
// `email` is the decrypted MarketingSettings.email sub-document.
export const buildTransport = (email) =>
  nodemailer.createTransport({
    host: email.host,
    port: Number(email.port) || 587,
    secure: !!email.secure, // true for 465, false for 587/STARTTLS
    auth: { user: email.user, pass: email.pass },
  });

const fromHeader = (email) => {
  const addr = email.fromEmail || email.user;
  return email.fromName ? `"${email.fromName}" <${addr}>` : addr;
};

// Verify the SMTP connection (used by the "Send test" / save flow).
export const verifyEmail = async (email) => {
  const transport = buildTransport(email);
  await transport.verify();
};

export const sendEmail = async (transport, email, to, subject, body) => {
  if (!to) throw new Error('No email address');
  return transport.sendMail({
    from: fromHeader(email),
    to,
    subject,
    text: body,
    html: body.replace(/\n/g, '<br>'),
  });
};
