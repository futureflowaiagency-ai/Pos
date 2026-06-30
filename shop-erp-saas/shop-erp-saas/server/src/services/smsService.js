// Sends a single SMS using the shop owner's own gateway credentials.
// `sms` is the decrypted MarketingSettings.sms sub-document.
// Throws on failure so the caller can record a per-recipient error.

const sendViaHttp = async (sms, to, message) => {
  const params = {
    [sms.paramApiKey || 'api_key']: sms.apiKey,
    [sms.paramTo || 'to']: to,
    [sms.paramMessage || 'msg']: message,
  };
  if (sms.senderId) params[sms.paramSender || 'sender_id'] = sms.senderId;

  let res;
  if ((sms.method || 'GET') === 'GET') {
    const url = new URL(sms.apiUrl);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    res = await fetch(url, { method: 'GET' });
  } else {
    res = await fetch(sms.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString(),
    });
  }
  const text = await res.text();
  if (!res.ok) throw new Error(`Gateway responded ${res.status}: ${text.slice(0, 200)}`);
  return text;
};

const sendViaTwilio = async (sms, to, message) => {
  const sid = sms.twilioAccountSid;
  const auth = Buffer.from(`${sid}:${sms.twilioAuthToken}`).toString('base64');
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, From: sms.twilioFrom, Body: message }).toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Twilio responded ${res.status}`);
  return data.sid;
};

export const sendSms = async (sms, to, message) => {
  if (!to) throw new Error('No phone number');
  if (sms.provider === 'twilio') return sendViaTwilio(sms, to, message);
  if (!sms.apiUrl) throw new Error('SMS gateway URL not configured');
  return sendViaHttp(sms, to, message);
};
