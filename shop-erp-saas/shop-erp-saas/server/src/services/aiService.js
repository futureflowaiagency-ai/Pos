import Anthropic from '@anthropic-ai/sdk';

// AI text generation for the app (marketing copy + dashboard summary).
//
// Two ways to power it:
//  1. CENTRAL FREE KEYS (platform-funded) — set GEMINI_API_KEY and/or GROQ_API_KEY
//     in the server .env. Every shop then gets AI for free, no setup on their side.
//     Both are tried in order, so if one is rate-limited/down the other takes over.
//  2. BRING-YOUR-OWN — a shop may still save its own Anthropic/OpenAI key in
//     Marketing settings; if present it is tried FIRST, then the central keys.

const buildPrompt = ({ channel, instructions, businessName, tone, lang }) => {
  const limit = channel === 'sms'
    ? 'Keep it under 300 characters (SMS-friendly). Plain text only — no markdown, no subject line.'
    : 'Write a short email body (a few short paragraphs). Plain text only — no subject line, no markdown headings.';
  return [
    businessName ? `You are writing marketing copy for a shop called "${businessName}".` : 'You are writing marketing copy for a small shop.',
    `Channel: ${channel === 'sms' ? 'SMS' : 'Email'}.`,
    tone ? `Tone: ${tone}.` : '',
    lang === 'bn' ? 'Write the message in Bengali (Bangla).' : '',
    `Use {{name}} as a placeholder where the customer's name should appear.`,
    limit,
    'Output ONLY the message text — no preamble, no explanation, no quotes.',
    '',
    `Campaign brief: ${instructions}`,
  ].filter(Boolean).join('\n');
};

// ---- per-provider callers ----

const genAnthropic = async (cfg, prompt, maxTokens) => {
  const client = new Anthropic({ apiKey: cfg.apiKey });
  const res = await client.messages.create({
    model: cfg.model || 'claude-opus-4-8',
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  });
  return res.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
};

const genOpenAI = async (cfg, prompt, maxTokens) => {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: cfg.model || 'gpt-4o-mini',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message || `OpenAI responded ${res.status}`);
  return (data.choices?.[0]?.message?.content || '').trim();
};

// Groq is OpenAI-compatible — same shape, different host. Free tier, very fast.
const genGroq = async (cfg, prompt, maxTokens) => {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: cfg.model || 'llama-3.3-70b-versatile',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message || `Groq responded ${res.status}`);
  return (data.choices?.[0]?.message?.content || '').trim();
};

// Google Gemini — free tier (key from aistudio.google.com).
const genGemini = async (cfg, prompt, maxTokens) => {
  const model = cfg.model || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cfg.apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: maxTokens },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message || `Gemini responded ${res.status}`);
  const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
  return text.trim();
};

const callers = { anthropic: genAnthropic, openai: genOpenAI, groq: genGroq, gemini: genGemini };

// ---- vision (image) callers — only providers that actually support image input.
// Groq's central free model (llama-3.3-70b-versatile, text-only) is deliberately
// excluded here; a shop's own Groq key wouldn't help with a photo either.
const genGeminiVision = async (cfg, imageBase64, mimeType, prompt, maxTokens) => {
  const model = cfg.model || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cfg.apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: imageBase64 } }] }],
      generationConfig: { maxOutputTokens: maxTokens },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message || `Gemini responded ${res.status}`);
  const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
  return text.trim();
};

const genAnthropicVision = async (cfg, imageBase64, mimeType, prompt, maxTokens) => {
  const client = new Anthropic({ apiKey: cfg.apiKey });
  const res = await client.messages.create({
    model: cfg.model || 'claude-opus-4-8',
    max_tokens: maxTokens,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mimeType, data: imageBase64 } },
        { type: 'text', text: prompt },
      ],
    }],
  });
  return res.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
};

const genOpenAIVision = async (cfg, imageBase64, mimeType, prompt, maxTokens) => {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: cfg.model || 'gpt-4o-mini',
      max_tokens: maxTokens,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
        ],
      }],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message || `OpenAI responded ${res.status}`);
  return (data.choices?.[0]?.message?.content || '').trim();
};

const visionCallers = { gemini: genGeminiVision, anthropic: genAnthropicVision, openai: genOpenAIVision };

// True if the platform has at least one central free key configured.
export const hasCentralAI = () => !!(process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY);

// True if a vision-capable provider is available (central Gemini, or a shop's
// own Anthropic/OpenAI key — Groq is text-only so it doesn't count here).
export const hasVisionAI = (ai) => !!process.env.GEMINI_API_KEY || (ai?.apiKey && ['anthropic', 'openai'].includes(ai?.provider));

// Ordered list of providers to attempt: the platform's free central keys
// first (Gemini → Groq), then a shop's own key as a last resort if it set one.
const buildChain = (ai) => {
  const chain = [];
  if (process.env.GEMINI_API_KEY) {
    chain.push({ provider: 'gemini', apiKey: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL || 'gemini-2.0-flash' });
  }
  if (process.env.GROQ_API_KEY) {
    chain.push({ provider: 'groq', apiKey: process.env.GROQ_API_KEY, model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile' });
  }
  if (ai?.apiKey && ai?.provider && callers[ai.provider]) {
    chain.push({ provider: ai.provider, apiKey: ai.apiKey, model: ai.model });
  }
  return chain;
};

// Generic text generation with automatic provider fallback.
export const generateText = async (ai, prompt, maxTokens = 1500) => {
  const chain = buildChain(ai);
  if (!chain.length) throw new Error('AI is not configured. Add a free Gemini/Groq key on the server, or your own key in Marketing settings.');
  let lastErr;
  for (const cfg of chain) {
    try {
      const out = await callers[cfg.provider](cfg, prompt, maxTokens);
      if (out) return out;
      lastErr = new Error('Empty AI response');
    } catch (e) {
      lastErr = e; // try the next provider in the chain
    }
  }
  throw lastErr || new Error('All AI providers failed');
};

export const generateCopy = async (ai, opts) => generateText(ai, buildPrompt(opts), 1500);

// Vision chain: central Gemini first (if configured), then the shop's own key
// only if it's a vision-capable provider.
const buildVisionChain = (ai) => {
  const chain = [];
  if (process.env.GEMINI_API_KEY) {
    chain.push({ provider: 'gemini', apiKey: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL || 'gemini-2.0-flash' });
  }
  if (ai?.apiKey && ['anthropic', 'openai'].includes(ai?.provider)) {
    chain.push({ provider: ai.provider, apiKey: ai.apiKey, model: ai.model });
  }
  return chain;
};

// Image + prompt in, best-effort text out (with provider fallback), for reading
// a photo of a product/box/IMEI label. imageBase64 must NOT include the
// "data:...;base64," prefix — just the raw base64 payload.
export const generateVision = async (ai, imageBase64, mimeType, prompt, maxTokens = 500) => {
  const chain = buildVisionChain(ai);
  if (!chain.length) throw new Error('No vision-capable AI is configured. Add a free Gemini key on the server, or your own Anthropic/OpenAI key in Marketing settings.');
  let lastErr;
  for (const cfg of chain) {
    try {
      const out = await visionCallers[cfg.provider](cfg, imageBase64, mimeType, prompt, maxTokens);
      if (out) return out;
      lastErr = new Error('Empty AI response');
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('All vision AI providers failed');
};
