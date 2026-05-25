/**
 * MoonAi — DEX Paid proxy
 * Proxies DexScreener orders API server-side to avoid browser CORS issues.
 */
const { isValidCA, getIP } = require('./_validate');
const { checkRateLimit }   = require('./_ratelimit');

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://moonaiapp.xyz';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const ip      = getIP(req);
  const allowed = await checkRateLimit(ip, { limit: 60, window: 60, prefix: 'dexpaid' }).catch(() => false);
  if (!allowed) return res.status(429).json({ error: 'Rate limit exceeded.' });

  const { ca } = req.query;
  if (!ca || !isValidCA(ca)) return res.status(400).json({ error: 'Invalid token address.' });

  try {
    const r = await fetch(`https://api.dexscreener.com/orders/v1/solana/${encodeURIComponent(ca)}`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!r.ok) return res.json({ paid: false, type: null });

    const raw = await r.json();
    // DexScreener may return array or object with status/message on error
    const orders = Array.isArray(raw) ? raw : [];

    const paid = orders.some(o => o.status === 'approved' || o.status === 'processing');

    let type = null;
    if (paid) {
      const hasTakeover = orders.some(o => o.type === 'communityTakeover' && (o.status === 'approved' || o.status === 'processing'));
      const hasAd       = orders.some(o => (o.type === 'tokenAd' || o.type === 'trendingBarAd' || o.type === 'bannerAd') && (o.status === 'approved' || o.status === 'processing'));
      type = hasTakeover ? 'takeover' : hasAd ? 'boosted' : 'profile';
    }

    return res.json({ paid, type });
  } catch {
    return res.json({ paid: false, type: null });
  }
};
