/**
 * MoonAi — holder-gate pass (shared, not a public route)
 *
 * Issues + verifies short-lived HMAC passes that prove a wallet cleared the
 * "holds >= N $MOONAI" check in /api/token-gate, so gated endpoints
 * (/api/verdict) can re-verify cheaply without re-hitting an RPC every call.
 *
 * The pass is NOT a bearer of money — it only unlocks a free, holder-only
 * AI feature — so an HMAC over (address.exp) is sufficient. Stateless: no DB.
 */
const crypto = require('crypto');

// Dedicated GATE_SECRET preferred; fall back to an existing stable server
// secret so the feature works before a dedicated one is provisioned.
const SECRET = process.env.GATE_SECRET || process.env.ANTHROPIC_API_KEY || 'moonai-dev-gate-secret';
const PASS_TTL_MS = 30 * 60 * 1000; // 30 min

const MINT      = process.env.MOONAI_MINT || '';                 // set in Vercel once token is live
const THRESHOLD = parseFloat(process.env.MOONAI_GATE_MIN) || 300; // tokens required

function signPass(address, ttlMs = PASS_TTL_MS) {
  const exp     = Date.now() + ttlMs;
  const payload = `${address}.${exp}`;
  const body    = Buffer.from(payload).toString('base64url');
  const sig     = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  return `${body}.${sig}`;
}

function verifyPass(pass) {
  if (!pass || typeof pass !== 'string') return null;
  const [body, sig] = pass.split('.');
  if (!body || !sig) return null;
  let payload;
  try { payload = Buffer.from(body, 'base64url').toString(); } catch { return null; }
  const expect = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  const a = Buffer.from(sig), b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const idx = payload.lastIndexOf('.');
  const address = payload.slice(0, idx);
  const exp     = Number(payload.slice(idx + 1));
  if (!address || !exp || Date.now() > exp) return null;
  return { address };
}

module.exports = { signPass, verifyPass, MINT, THRESHOLD, PASS_TTL_MS };
