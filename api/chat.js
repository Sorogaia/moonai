const ANTHROPIC_KEY  = process.env.ANTHROPIC_API_KEY;
const UPSTASH_URL    = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN  = process.env.UPSTASH_REDIS_REST_TOKEN;

const RATE_LIMIT     = 20;   // requests per window per IP
const RATE_WINDOW    = 60;   // seconds

async function checkRateLimit(ip) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return true;
  const key = `moonai:rl:${ip}`;
  const res = await fetch(`${UPSTASH_URL}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([['INCR', key], ['EXPIRE', key, RATE_WINDOW]]),
  });
  const data = await res.json();
  const count = data?.[0]?.result ?? 0;
  return count <= RATE_LIMIT;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: { message: 'Method not allowed' } });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const allowed = await checkRateLimit(ip).catch(() => true);
  if (!allowed) {
    return res.status(429).json({ error: { message: 'Rate limit exceeded — try again in a minute.' } });
  }

  const { model, max_tokens, system, messages } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: { message: 'Invalid request: messages array required.' } });
  }

  if (!ANTHROPIC_KEY) {
    return res.status(500).json({ error: { message: 'Server misconfiguration: missing API key.' } });
  }

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model, max_tokens, system, messages }),
    });

    const data = await upstream.json();
    return res.status(upstream.status).json(data);
  } catch (e) {
    return res.status(502).json({ error: { message: `Proxy error: ${e.message}` } });
  }
};
