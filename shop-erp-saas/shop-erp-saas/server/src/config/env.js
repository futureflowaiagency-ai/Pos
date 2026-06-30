import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/shop_erp_saas',
  jwtSecret: process.env.JWT_SECRET || 'dev_secret_change_me',
  jwtExpire: process.env.JWT_EXPIRE || '30d',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
  },
  // Secret used to encrypt tenant-supplied credentials (SMS/SMTP/AI keys) at rest.
  // Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  encryptionKey: process.env.ENCRYPTION_KEY || 'dev_encryption_key_change_me_please',
  // Platform "system" mailbox — used for system emails like the password-change
  // verification code. Typically a Gmail address with an App Password.
  systemMail: {
    host: process.env.SMTP_HOST || '',
    port: process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_SECURE === 'true', // true for port 465
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || '',
    fromName: process.env.SMTP_FROM_NAME || 'Shop ERP',
  },
};
