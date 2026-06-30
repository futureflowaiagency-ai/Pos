import nodemailer from 'nodemailer';

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
