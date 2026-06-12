/**
 * MoonAi — holder gate
 *
 * Proves a Phantom wallet (a) owns its address (Ed25519 signature over a fresh
 * challenge message) and (b) holds >= THRESHOLD $MOONAI, then issues a short
 * HMAC pass that unlocks the holder-only "Full AI Risk Verdict" (/api/verdict).
 *
 * Zero external deps: base58 decode is inline, signature verification uses
 * Node's native crypto Ed25519, balance comes from Helius RPC.
 */
const crypto             = require('crypto');
const { getIP }          = require('./_validate');
const { checkRateLimit } = require('./_ratelimit');
const { signPass, MINT, THRESHOLD } = require('./_gate');

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://moonaiapp.xyz';
const HELIUS_KEY     = process.env.HELIUS_API_KEY;
const RPC_URL        = () => `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`;
const CHALLENGE_TTL_MS = 5 * 60 * 1000; // signed message must be < 5 min old

// ── base58 decode (Bitcoin alphabet) ──
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const B58MAP = (() => { const m = {}; for (let i = 0; i < B58.length; i++) m[B58[i]] = i; return m; })();
function b58decode(str) {
  if (!str) return null;
  const bytes = [0];
  for (const ch of str) {
    const val = B58MAP[ch];
    if (val === undefined) return null;
    let carry = val;
    for (let j = 0; j < bytes.length; j++) { carry += bytes[j] * 58; bytes[j] = carry & 0xff; carry >>= 8; }
    while (carry) { bytes.push(carry & 0xff); carry >>= 8; }
  }
  for (let k = 0; k < str.length && str[k] === '1'; k++) bytes.push(0);
  return Buffer.from(bytes.reverse());
}

// Verify an Ed25519 signature given a raw 32-byte public key
function verifyEd25519(message, signature, pubkeyRaw) {
  try {
    const der    = Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), pubkeyRaw]);
    const keyObj = crypto.createPublicKey({ key: der, format: 'der', type: 'spki' });
    return crypto.verify(null, message, keyObj, signature);
  } catch { return false; }
}

async function getMoonaiBalance(address) {
  const res = await fetch(RPC_URL(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 'gate', method: 'getTokenAccountsByOwner',
      params: [address, { mint: MINT }, { encoding: 'jsonParsed' }],
    }),
  });
  const data = await res.json();
  const accts = data?.result?.value || [];
  let total = 0;
  for (const a of accts) total += a.account?.data?.parsed?.info?.tokenAmount?.uiAmount || 0;
  return total;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

  const ip      = getIP(req);
  const allowed = await checkRateLimit(ip, { limit: 15, window: 60, prefix: 'gate' }).catch(() => false);
  if (!allowed) return res.status(429).json({ error: 'Too many attempts. Try again shortly.' });

  // Token not configured yet → gate is closed for everyone (no false unlocks)
  if (!MINT) return res.json({ unlocked: false, balance: 0, threshold: THRESHOLD, reason: 'not-configured' });

  const { address, signature, message } = req.body || {};
  if (typeof address !== 'string' || typeof signature !== 'string' || typeof message !== 'string') {
    return res.status(400).json({ error: 'Missing address, signature or message.' });
  }
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
    return res.status(400).json({ error: 'Invalid wallet address.' });
  }

  // Challenge must target this app and be fresh (anti-replay)
  if (!message.includes('moonaiapp.xyz') || !message.includes('MoonAi')) {
    return res.status(400).json({ error: 'Invalid challenge.' });
  }
  const tsMatch = message.match(/Issued:\s*(\d{10,13})/);
  const issued  = tsMatch ? Number(tsMatch[1]) : NaN;
  if (!issued || Math.abs(Date.now() - issued) > CHALLENGE_TTL_MS) {
    return res.status(400).json({ error: 'Challenge expired — reconnect.' });
  }

  const pubkeyRaw = b58decode(address);
  let sigBuf;
  try { sigBuf = Buffer.from(signature, 'base64'); } catch { sigBuf = null; }
  if (!pubkeyRaw || pubkeyRaw.length !== 32 || !sigBuf || sigBuf.length !== 64) {
    return res.status(400).json({ error: 'Malformed key or signature.' });
  }
  if (!verifyEd25519(Buffer.from(message, 'utf8'), sigBuf, pubkeyRaw)) {
    return res.status(401).json({ error: 'Signature verification failed.' });
  }

  // Ownership proven — now check the bag
  let balance = 0;
  try { balance = await getMoonaiBalance(address); }
  catch { return res.status(502).json({ error: 'Could not read balance — try again.' }); }

  if (balance >= THRESHOLD) {
    return res.json({ unlocked: true, balance, threshold: THRESHOLD, pass: signPass(address) });
  }
  return res.json({ unlocked: false, balance, threshold: THRESHOLD });
};
