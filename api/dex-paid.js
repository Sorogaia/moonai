/**
 * Fluxr — DEX Paid proxy
 *
 * Detects whether a token has paid DexScreener for an enhanced profile, ads,
 * or community takeover. Uses two complementary signals because the orders
 * endpoint alone misses some legitimately-paid tokens (it doesn't cover every
 * historical payment path):
 *
 *   1. Orders API:  /orders/v1/solana/{ca}  — any non-rejected order means paid
 *   2. Tokens API:  /latest/dex/tokens/{ca} — presence of pair.info.header or
 *      pair.info.openGraph indicates the team paid for an enhanced profile
 *      (these fields are only populated for paid profiles, unlike imageUrl
 *      which can be auto-pulled from chain metadata for pump.fun tokens).
 *
 * If EITHER signal says paid, we report paid. This matches what Axiom and
 * other aggregators show.
 */
const { isValidCA, getIP } = require('./_validate');
const { checkRateLimit }   = require('./_ratelimit');

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://fluxrapp.xyz';

// Status values that mean "this order has been paid and accepted/live"
// (DexScreener has historically used approved/processing; we include
// other live-state synonyms defensively in case the API evolves)
const PAID_STATUSES = new Set(['approved', 'processing', 'live', 'active', 'completed']);

async function fetchOrders(ca) {
  try {
    const r = await fetch(`https://api.dexscreener.com/orders/v1/solana/${encodeURIComponent(ca)}`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!r.ok) return [];
    const raw = await r.json();
    return Array.isArray(raw) ? raw : [];
  } catch { return []; }
}

async function fetchPairInfo(ca) {
  try {
    const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(ca)}`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!r.ok) return null;
    const d = await r.json();
    const caLower = ca.toLowerCase();
    const pairs = d.pairs || [];
    // Prefer the Solana pair where this CA is the base token
    return pairs.find(p => p.chainId === 'solana' && p.baseToken?.address?.toLowerCase() === caLower)
        || pairs.find(p => p.chainId === 'solana')
        || null;
  } catch { return null; }
}

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

  // Hit both endpoints in parallel — under 10s function budget either way
  const [orders, pair] = await Promise.all([fetchOrders(ca), fetchPairInfo(ca)]);

  // ── Signal 1: orders API ─────────────────────────────────────────────
  const paidOrders = orders.filter(o =>
    PAID_STATUSES.has(o.status) || (o.paymentTimestamp && o.paymentTimestamp > 0)
  );
  const hasOrders = paidOrders.length > 0;

  // ── Signal 2: pair info indicates paid profile ───────────────────────
  // header and openGraph are ONLY populated when the team pays for an
  // enhanced profile. imageUrl alone is unreliable (auto-pulled for pump.fun).
  const info = pair?.info || {};
  const hasPaidProfile = !!(info.header || info.openGraph);

  const paid = hasOrders || hasPaidProfile;

  // Classify the payment type for the UI badge
  let type = null;
  if (paid) {
    const hasTakeover = paidOrders.some(o => o.type === 'communityTakeover');
    const hasAd = paidOrders.some(o =>
      o.type === 'tokenAd' || o.type === 'trendingBarAd' || o.type === 'bannerAd'
    );
    type = hasTakeover ? 'takeover' : hasAd ? 'boosted' : 'profile';
  }

  return res.json({ paid, type });
};
