/**
 * Beta access gate for MoonAi.
 *
 * GET  /api/beta-gate?action=verify&... — verify existing HMAC session token
 * POST /api/beta-gate  {password}       — authenticate with beta password
 *
 * Env vars required:
 *   BETA_PASSWORD — plaintext beta password
 */

const crypto = require('crypto');
const { getIP } = require('./_validate');

const BETA_PASSWORD = process.env.BETA_PASSWORD;
const EXPIRY_48H    = 48 * 3600 * 1000;

function makeToken(expiresAt) {
  return crypto
    .createHmac('sha256', BETA_PASSWORD || 'moonai-beta-fallback')
    .update(`beta:${expiresAt}`)
    .digest('hex');
}

module.exports = async function handler(req, res) {
  const ip = getIP(req);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');

  // ── GET — verify existing session token ──────────────────────────────
  if (req.method === 'GET') {
    const { action, token, expiresAt } = req.query || {};

    if (action === 'verify') {
      const exp = parseInt(expiresAt, 10);
      if (!token || !exp || Date.now() > exp) {
        return res.status(200).json({ ok: false });
      }
      const expected = makeToken(exp);
      let ok = false;
      try {
        if (token.length === 64) {
          ok = crypto.timingSafeEqual(
            Buffer.from(token, 'hex'),
            Buffer.from(expected, 'hex'),
          );
        }
      } catch { ok = false; }
      console.log(`[beta] verify ip=${ip} ok=${ok} ts=${new Date().toISOString()}`);
      return res.status(200).json({ ok });
    }

    return res.status(200).json({ ok: false });
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

    const { password } = body;
    const ts = new Date().toISOString();

    if (!password) return res.status(400).json({ ok: false });

    let pwOk = false;
    try {
      if (BETA_PASSWORD && password.length === BETA_PASSWORD.length) {
        pwOk = crypto.timingSafeEqual(
          Buffer.from(password, 'utf8'),
          Buffer.from(BETA_PASSWORD, 'utf8'),
        );
      }
    } catch { pwOk = false; }

    if (!pwOk) {
      console.log(`[beta] auth ip=${ip} ts=${ts} result=wrong_password`);
      return res.status(200).json({ ok: false });
    }

    const expiresAt = Date.now() + EXPIRY_48H;
    const sessionToken = makeToken(expiresAt);
    console.log(`[beta] auth ip=${ip} ts=${ts} result=ok`);
    return res.status(200).json({ ok: true, token: sessionToken, expiresAt });
  }

  return res.status(405).json({ error: 'method_not_allowed' });
};
