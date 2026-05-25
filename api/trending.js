/**
 * MoonAi — Trenches snapshot
 *
 * Aggregates a compact live view of what's moving on Solana right now from
 * pump.fun + DexScreener. The frontend injects this into the chat system
 * prompt so the AI can talk about "what's trending in the trenches" without
 * the user having to paste a specific CA.
 *
 * In-process cache (60s) — Vercel reuses warm instances, so under load this
 * collapses to one upstream fetch per minute per instance.
 */
const { getIP }          = require('./_validate');
const { checkRateLimit } = require('./_ratelimit');

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://moonaiapp.xyz';
const CACHE_TTL_MS   = 60_000;
let _cache = null;

const UA = 'Mozilla/5.0 (compatible; MoonAi/1.0; +https://moonaiapp.xyz)';
const FETCH_TIMEOUT_MS = 8_000;

function fetchWithTimeout(url, opts = {}) {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

async function fetchPumpList(sort, limit = 12) {
  try {
    const url = `https://frontend-api.pump.fun/coins?offset=0&limit=${limit}&sort=${encodeURIComponent(sort)}&order=DESC&includeNsfw=false`;
    const r = await fetchWithTimeout(url, { headers: { 'Accept': 'application/json', 'User-Agent': UA } });
    if (!r.ok) return [];
    const data = await r.json();
    if (!Array.isArray(data)) return [];
    return data.map(c => ({
      ca:          c.mint,
      symbol:      (c.symbol || '?').slice(0, 12),
      name:        (c.name   || '?').slice(0, 40),
      mc:          c.usd_market_cap ? Math.round(c.usd_market_cap) : null,
      bonded:      c.complete === true || !!c.raydium_pool,
      bondedPct:   c.bonding_curve_percentage != null ? parseFloat(c.bonding_curve_percentage) : null,
      holders:     c.holder_count || null,
      ageMin:      c.created_timestamp ? Math.floor((Date.now() - c.created_timestamp) / 60_000) : null,
      replies:     c.reply_count || 0,
      hasTwitter:  !!c.twitter,
      hasTelegram: !!c.telegram,
    })).filter(c => c.ca);
  } catch { return []; }
}

async function fetchDexBoosts() {
  try {
    const r = await fetchWithTimeout('https://api.dexscreener.com/token-boosts/top/v1', {
      headers: { 'Accept': 'application/json', 'User-Agent': UA },
    });
    if (!r.ok) return [];
    const data = await r.json();
    if (!Array.isArray(data)) return [];
    return data.filter(b => b.chainId === 'solana').slice(0, 10).map(b => ({
      ca:     b.tokenAddress,
      boosts: b.totalAmount || b.amount || 0,
    }));
  } catch { return []; }
}

// Enrich boost CAs with name/symbol/MC via DexScreener tokens endpoint
async function enrichBoosts(boosts) {
  if (!boosts.length) return boosts;
  const cas = boosts.map(b => b.ca).slice(0, 10).join(',');
  try {
    const r = await fetchWithTimeout(`https://api.dexscreener.com/tokens/v1/solana/${cas}`, {
      headers: { 'Accept': 'application/json', 'User-Agent': UA },
    });
    if (!r.ok) return boosts;
    const data = await r.json();
    // Endpoint returns array of pair objects directly
    const pairs = Array.isArray(data) ? data : (data.pairs || []);
    return boosts.map(b => {
      const p = pairs.find(pp => pp.baseToken?.address?.toLowerCase() === b.ca?.toLowerCase());
      if (!p) return b;
      return {
        ...b,
        symbol:  (p.baseToken?.symbol || '?').slice(0, 12),
        name:    (p.baseToken?.name || '?').slice(0, 40),
        mc:      p.marketCap || p.fdv || null,
        ch24:    p.priceChange?.h24 != null ? Math.round(p.priceChange.h24) : null,
        vol24h:  p.volume?.h24 ? Math.round(p.volume.h24) : null,
      };
    });
  } catch { return boosts; }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const ip      = getIP(req);
  const allowed = await checkRateLimit(ip, { limit: 30, window: 60, prefix: 'trending' }).catch(() => false);
  if (!allowed) return res.status(429).json({ error: 'Rate limit exceeded.' });

  // Serve cached if fresh — single upstream fetch per minute per instance
  if (_cache && Date.now() - _cache.ts < CACHE_TTL_MS) {
    return res.json(_cache.data);
  }

  // Fetch in parallel, then enrich boosts
  const [topMC, fresh, rawBoosts] = await Promise.all([
    fetchPumpList('usd_market_cap', 12),
    fetchPumpList('created_timestamp', 8),
    fetchDexBoosts(),
  ]);
  const boosts = await enrichBoosts(rawBoosts);

  const data = { topMC, fresh, boosts, ts: Date.now() };
  _cache = { ts: Date.now(), data };
  res.json(data);
};
