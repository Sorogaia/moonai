/**
 * Shared input validation for MoonAi API endpoints.
 * Underscore prefix = not exposed as a Vercel route.
 */

// Solana base58 address: 32–44 chars, no 0/O/I/l
const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function isValidCA(addr) {
  return typeof addr === 'string' && BASE58_RE.test(addr.trim());
}

function getIP(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
}

module.exports = { isValidCA, getIP };
