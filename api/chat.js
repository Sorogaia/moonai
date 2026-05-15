const { checkRateLimit } = require('./_ratelimit');
const { getIP }          = require('./_validate');

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const MAX_TOKENS_CAP = 4096; // hard server-side cap — prevents cost attacks
const ALLOWED_MODELS = ['claude-sonnet-4-5', 'claude-haiku-4-5'];

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: { message: 'Method not allowed' } });

  // Rate limit: 20 AI requests per minute per IP
  const ip      = getIP(req);
  const allowed = await checkRateLimit(ip, { limit: 20, window: 60, prefix: 'chat' }).catch(() => true);
  if (!allowed) {
    return res.status(429).json({ error: { message: 'Rate limit exceeded — try again in a minute.' } });
  }

  const { model, max_tokens, system, messages } = req.body || {};

  // Validate messages
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: { message: 'Invalid request.' } });
  }

  // Cap tokens — prevent cost abuse
  const safeTokens = Math.min(parseInt(max_tokens) || 1024, MAX_TOKENS_CAP);

  // Validate model — only allow known safe models
  const safeModel = ALLOWED_MODELS.includes(model) ? model : ALLOWED_MODELS[0];

  if (!ANTHROPIC_KEY) {
    return res.status(500).json({ error: { message: 'Service unavailable.' } });
  }

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model: safeModel, max_tokens: safeTokens, system, messages }),
    });

    const data = await upstream.json();
    return res.status(upstream.status).json(data);
  } catch {
    return res.status(502).json({ error: { message: 'Service temporarily unavailable.' } });
  }
};
