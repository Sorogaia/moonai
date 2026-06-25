/**
 * Fluxr — Token narrative (lore) generator
 *
 * Dedicated lightweight endpoint for the lore bubble that fires on every
 * token analysis. Skips Turnstile (which was adding 2-7s of wait time
 * before the request even hit Anthropic) because:
 *
 *   - The prompt is server-controlled — no user-supplied prompt to inject.
 *   - Inputs are scrubbed and length-capped (name/symbol/description only).
 *   - Output is capped at 60 tokens, single sentence.
 *   - Rate-limited per IP (30/min) + daily-capped (100/day) like /api/chat.
 *   - Kill switch still applies.
 *
 * Net effect: lore appears in 1-2s instead of 5-10s.
 */
const { checkRateLimit, checkDailyLimit, checkKillSwitch } = require('./_ratelimit');
const { getIP } = require('./_validate');

const ANTHROPIC_KEY   = process.env.ANTHROPIC_API_KEY;
const ALLOWED_ORIGIN  = process.env.ALLOWED_ORIGIN || 'https://fluxrapp.xyz';
const MAX_NAME_LEN    = 100;
const MAX_SYMBOL_LEN  = 20;
const MAX_DESC_LEN    = 200;
const MAX_CH_LEN      = 30;

const LORE_SYSTEM = `Write ONE short factual sentence (max 16 words) describing what this token is — its theme, mascot, or core concept. Neutral tone, no opinions, no jokes, no slang, no roasting, no praising. No price talk, no disclaimers, no "based on the description" preamble. Just the concept in plain language.

Examples of the exact output style:
- "A Solana memecoin themed around the Doge mascot."
- "A community-driven token referencing the Wojak meme character."
- "A pump.fun launch built around the Hat Wif Cat meme."
- "A Solana token themed around a viral moment from a Twitch stream."

If the token's description gives a concept, use it. If not, describe it from the name and ticker alone in the same neutral one-line format.`;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: { message: 'Method not allowed' } });

  const ip = getIP(req);

  // Kill switch
  const alive = await checkKillSwitch().catch(() => true);
  if (!alive) return res.status(503).json({ error: { message: 'Service temporarily unavailable.' } });

  // Per-minute rate limit (30/min — these auto-fire on each analysis, slightly more generous than chat)
  const allowed = await checkRateLimit(ip, { limit: 30, window: 60, prefix: 'lore' }).catch(() => false);
  if (!allowed) return res.status(429).json({ error: { message: 'Rate limit exceeded — try again in a minute.' } });

  // Per-IP daily cap (shares the chat bucket — same wallet uses up the same budget)
  const dailyOk = await checkDailyLimit(ip, 'chat').catch(() => true);
  if (!dailyOk) return res.status(429).json({ error: { message: 'Daily limit reached — resets at midnight UTC.' } });

  // Scrub + cap inputs
  const body = req.body || {};
  const safeName   = String(body.name        || '').slice(0, MAX_NAME_LEN  ).trim().replace(/[\r\n]+/g, ' ') || 'Unknown';
  const safeSymbol = String(body.symbol      || '').slice(0, MAX_SYMBOL_LEN).trim().replace(/[\r\n]+/g, ' ') || '?';
  const safeDesc   = String(body.description || '').slice(0, MAX_DESC_LEN  ).trim().replace(/[\r\n]+/g, ' ');
  const safeCh24   = String(body.ch24        || '').slice(0, MAX_CH_LEN    ).trim();

  // Server-controlled user message format — no client injection vector
  const userMessage = `${safeName} ($${safeSymbol})${safeDesc ? ' — ' + safeDesc : ''}${safeCh24 ? ' — 24h ' + safeCh24 : ''}`;

  if (!ANTHROPIC_KEY) return res.status(500).json({ error: { message: 'Service unavailable.' } });

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5',
        max_tokens: 60,
        system:     LORE_SYSTEM,
        messages:   [{ role: 'user', content: userMessage }],
      }),
    });

    const data = await upstream.json();
    return res.status(upstream.status).json(data);
  } catch {
    return res.status(502).json({ error: { message: 'Service temporarily unavailable.' } });
  }
};
