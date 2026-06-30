import mongoose from 'mongoose';

// Per-business marketing credentials — "bring your own keys".
// Every shop owner configures their OWN SMS gateway, SMTP mailbox and AI key,
// and pays their own provider costs. Secret fields are stored encrypted
// (see utils/secretCrypto.js) and never returned to the client in plaintext.
const marketingSettingsSchema = new mongoose.Schema(
  {
    business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, unique: true, index: true },

    // ---- SMS gateway (generic HTTP — works with most providers, e.g. BulkSMSBD, MIM SMS, Twilio-style) ----
    sms: {
      enabled: { type: Boolean, default: false },
      // 'http' = generic GET/POST gateway, 'twilio' = Twilio REST API
      provider: { type: String, enum: ['http', 'twilio'], default: 'http' },
      apiUrl: { type: String, default: '' },          // e.g. https://api.sms.net.bd/sendsms
      method: { type: String, enum: ['GET', 'POST'], default: 'GET' },
      apiKey: { type: String, default: '' },           // encrypted
      senderId: { type: String, default: '' },         // approved sender / mask
      // Field names the gateway expects (generic provider only).
      paramApiKey: { type: String, default: 'api_key' },
      paramTo: { type: String, default: 'to' },
      paramMessage: { type: String, default: 'msg' },
      paramSender: { type: String, default: 'sender_id' },
      // Twilio-specific
      twilioAccountSid: { type: String, default: '' },
      twilioAuthToken: { type: String, default: '' },  // encrypted
      twilioFrom: { type: String, default: '' },
    },

    // ---- SMTP email ----
    email: {
      enabled: { type: Boolean, default: false },
      host: { type: String, default: '' },
      port: { type: Number, default: 587 },
      secure: { type: Boolean, default: false },       // true for 465
      user: { type: String, default: '' },
      pass: { type: String, default: '' },             // encrypted
      fromName: { type: String, default: '' },
      fromEmail: { type: String, default: '' },
    },

    // ---- AI assistant (for drafting campaign copy) ----
    ai: {
      enabled: { type: Boolean, default: false },
      provider: { type: String, enum: ['anthropic', 'openai'], default: 'anthropic' },
      apiKey: { type: String, default: '' },           // encrypted
      model: { type: String, default: 'claude-opus-4-8' },
    },
  },
  { timestamps: true }
);

export default mongoose.model('MarketingSettings', marketingSettingsSchema);
