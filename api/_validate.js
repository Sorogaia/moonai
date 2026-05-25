/**
 * Shared input validation for MoonAi API endpoints.
 * Underscore prefix = not exposed as a Vercel route.
 */

// Solana base58 address: 32–44 chars, no 0/O/I/l
const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

// Alphanumeric token symbol (max 20 chars)
const SYMBOL_RE = /^[A-Z0-9$_.]{1,20}$/i;

function isValidCA(addr) {
  return typeof addr === 'string' && BASE58_RE.test(addr.trim());
}

function isValidSymbol(sym) {
  return typeof sym === 'string' && SYMBOL_RE.test(sym.trim());
}

/**
 * Extract real client IP.
 * Uses Vercel's x-vercel-forwarded-for which cannot be spoofed by the client,
 * unlike x-forwarded-for which is a user-supplied header.
 */
function getIP(req) {
  return (
    req.headers['x-vercel-forwarded-for'] ||
    req.headers['cf-connecting-ip'] ||          // Cloudflare (if behind CF)
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

/**
 * Validate an image URL from a third-party API before returning it to the client.
 * Allows https://, http:// (upgraded), and ipfs:// (converted to public gateway).
 * Blocks javascript:, data:, and anything else.
 */
function safeImageUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const t = url.trim();
  if (t.startsWith('https://')) return t;
  if (t.startsWith('http://'))  return 'https://' + t.slice(7);
  if (t.startsWith('ipfs://'))  return 'https://ipfs.io/ipfs/' + t.slice(7);
  return null;
}

module.exports = { isValidCA, isValidSymbol, getIP, safeImageUrl };
