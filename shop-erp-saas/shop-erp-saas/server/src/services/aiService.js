import Anthropic from '@anthropic-ai/sdk';

// Drafts marketing copy using the shop owner's OWN AI key (they pay their own cost).
// `ai` is the decrypted MarketingSettings.ai sub-document.
// Returns plain text suitable for an SMS or email body.

const buildPrompt = ({ channel, instructions, businessName, tone }) => {
  const limit = channel === 'sms'
    ? 'Keep it under 300 characters (SMS-friendly). Plain text only — no markdown, no subject line.'
    : 'Write a short email body (a few short paragraphs). Plain text only — no subject line, no markdown headings.';
  return [
    businessName ? `You are writing marketing copy for a shop called "${businessName}".` : 'You are writing marketing copy for a small shop.',
    `Channel: ${channel === 'sms' ? 'SMS' : 'Email'}.`,
    tone ? `Tone: ${tone}.` : '',
    `Use {{name}} as a placeholder where the customer's name should appear.`,
    limit,
    'Output ONLY the message text — no preamble, no explanation, no quotes.',
    '',
    `Campaign brief: ${instructions}`,
  ].filter(Boolean).join('\n');
};

const generateAnthropic = async (ai, prompt) => {
  const client = new Anthropic({ apiKey: ai.apiKey });
  const res = await client.messages.create({
    model: ai.model || 'claude-opus-4-8',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });
  return res.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
};

const generateOpenAI = async (ai, prompt) => {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ai.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: ai.model || 'gpt-4o-mini',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message || `OpenAI responded ${res.status}`);
  return (data.choices?.[0]?.message?.content || '').trim();
};

export const generateCopy = async (ai, opts) => {
  if (!ai?.apiKey) throw new Error('AI key not configured');
  const prompt = buildPrompt(opts);
  return ai.provider === 'openai' ? generateOpenAI(ai, prompt) : generateAnthropic(ai, prompt);
};
