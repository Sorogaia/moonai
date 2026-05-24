/**
 * Beta access gate for MoonAi.
 *
 * GET  /api/beta-gate?ref=CODE             — validate ref code, log attempt
 * GET  /api/beta-gate?action=verify&...    — verify existing HMAC session token
 * POST /api/beta-gate  {ref, password}     — authenticate with beta password
 *
 * Env vars required:
 *   BETA_CODES    — JSON: {"CODE": "Name", ...} (4 codes, names for logs)
 *   BETA_PASSWORD — plaintext beta password
 *   UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN — 48h expiry tracking
 */

const crypto = require('crypto');
const { getIP } = require('./_validate');

const UPSTASH_URL   = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const BETA_PASSWORD = process.env.BETA_PASSWORD;
const EXPIRY_48H    = 48 * 3600 * 1000;

function parseBetaCodes() {
  try { return JSON.parse(process.env.BETA_CODES || '{}'); }
  catch { return {}; }
}

async function redisCmd(...args) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return null;
  try {
    const res = await fetch(`${UPSTASH_URL}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([args]),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.[0]?.result ?? null;
  } catch { return null; }
}

function makeToken(ref, expiresAt) {
  return crypto
    .createHmac('sha256', BETA_PASSWORD || 'moonai-beta-fallback')
    .update(`${ref}:${expiresAt}`)
    .digest('hex');
}

module.exports = async function handler(req, res) {
  const ip = getIP(req);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');

  // ── GET ──────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { ref, action, token, expiresAt } = req.query || {};

    // Verify existing session token
    if (action === 'verify') {
      const exp = parseInt(expiresAt, 10);
      if (!ref || !token || !exp || Date.now() > exp) {
        return res.status(200).json({ ok: false });
      }
      const expected = makeToken(ref, exp);
      let ok = false;
      try {
        if (token.length === 64) {
          ok = crypto.timingSafeEqual(
            Buffer.from(token, 'hex'),
            Buffer.from(expected, 'hex'),
          );
        }
      } catch { ok = false; }
      console.log(`[beta] verify ref=${ref} ip=${ip} ok=${ok} ts=${new Date().toISOString()}`);
      return res.status(200).json({ ok });
    }

    // Ref code validation + access log
    const ts = new Date().toISOString();

    if (!ref) {
      console.log(`[beta] access ref=none ip=${ip} ts=${ts} result=no_ref`);
      return res.status(200).json({ valid: false, reason: 'no_ref' });
    }

    const codes = parseBetaCodes();
    if (!codes[ref]) {
      console.log(`[beta] access ref=${ref} ip=${ip} ts=${ts} result=invalid`);
      return res.status(200).json({ valid: false, reason: 'invalid' });
    }

    // 48h expiry — track first use in Redis with NX to handle concurrent requests
    const redisKey = `moonai:beta:first_use:${ref}`;
    let firstUsed = await redisCmd('GET', redisKey);

    if (!firstUsed) {
      const now = String(Date.now());
      await redisCmd('SET', redisKey, now, 'EX', 172800, 'NX');
      firstUsed = (await redisCmd('GET', redisKey)) || now;
    }

    const elapsed = Date.now() - parseInt(firstUsed, 10);
    if (elapsed > EXPIRY_48H) {
      console.log(`[beta] access ref=${ref} name=${codes[ref]} ip=${ip} ts=${ts} result=expired`);
      return res.status(200).json({ valid: false, reason: 'expired' });
    }

    console.log(`[beta] access ref=${ref} name=${codes[ref]} ip=${ip} ts=${ts} result=valid`);
    return res.status(200).json({ valid: true, name: codes[ref] });
  }

  // ── POST — authenticate with password ────────────────────────────────
  if (req.method === 'POST') {
    let body = {};
    try {
      body = typeof req.body === 'object' && req.body !== null
        ? req.body
        : JSON.parse(req.body || '{}');
    } catch {
      return res.status(400).json({ ok: false });
    }

    const { ref, password } = body;
    const ts = new Date().toISOString();

    if (!ref || !password) return res.status(400).json({ ok: false });

    const codes = parseBetaCodes();
    if (!codes[ref]) {
      console.log(`[beta] auth ref=${ref} ip=${ip} ts=${ts} result=invalid_ref`);
      return res.status(200).json({ ok: false });
    }

    if (!BETA_PASSWORD || password !== BETA_PASSWORD) {
      console.log(`[beta] auth ref=${ref} name=${codes[ref]} ip=${ip} ts=${ts} result=wrong_password`);
      return res.status(200).json({ ok: false });
    }

    const expiresAt = Date.now() + EXPIRY_48H;
    const sessionToken = makeToken(ref, expiresAt);
    console.log(`[beta] auth ref=${ref} name=${codes[ref]} ip=${ip} ts=${ts} result=ok`);
    return res.status(200).json({ ok: true, token: sessionToken, expiresAt });
  }

  return res.status(405).json({ error: 'method_not_allowed' });
};
