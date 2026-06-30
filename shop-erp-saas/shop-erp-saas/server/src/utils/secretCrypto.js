import crypto from 'crypto';
import { config } from '../config/env.js';

// AES-256-GCM encryption for tenant-supplied credentials (SMS / SMTP / AI keys).
// Shop owners bring their own keys; we must never store them in plaintext.
// Stored format: base64(iv).base64(authTag).base64(ciphertext)

// Derive a stable 32-byte key from the configured secret.
const KEY = crypto.scryptSync(config.encryptionKey, 'shop-erp-marketing-salt', 32);

export const encryptSecret = (plain) => {
  if (plain === undefined || plain === null || plain === '') return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join('.');
};

export const decryptSecret = (stored) => {
  if (!stored) return '';
  try {
    const [ivB64, tagB64, dataB64] = String(stored).split('.');
    if (!ivB64 || !tagB64 || !dataB64) return '';
    const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
};

// For UI: show only that a secret is set, never the value itself.
export const maskSecret = (stored) => (stored ? '••••••••' : '');
