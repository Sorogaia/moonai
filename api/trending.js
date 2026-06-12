/**
 * MoonAi — Trenches snapshot
 *
 * Aggregates a compact live view of what's moving on Solana right now.
 *
 * Source: GeckoTerminal (free, no key) for top/new pools + DexScreener for the
 * paid-attention "boosted" list. pump.fun's frontend-api is Cloudflare-walled
 * (403 from datacenter IPs), so it can't be reached from Vercel — GeckoTerminal
 * replaces it and is already the project's ATH/launch data source.
 *
 * The frontend renders this on the welcome screen AND injects it into the chat
 * system prompt so the AI can talk about "what's trending in the trenches"
 * without the user pasting a specific CA.
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
const GT = 'https://api.geckoterminal.com/api/v2/networks/solana';

function fetchWithTimeout(url, opts = {}) {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

function num(v) {
  if (v == null) return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

/**
 * Fetch + normalise a GeckoTerminal pool list (trending_pools / new_pools).
 * `include=base_token` adds an `included[]` array of token objects we map by id
 * to pull real symbol/name/image (pool name alone is just "SYM / SOL").
 */
async function fetchGtPools(path, limit = 12) {
  try {
    const r = await fetchWithTimeout(`${GT}/${path}?page=1&include=base_token`, {
      headers: { 'Accept': 'application/json', 'User-Agent': UA },
    });
    if (!r.ok) return [];
    const json = await r.json();
    const pools = Array.isArray(json.data) ? json.data : [];

    const tokMap = {};
    (json.included || []).forEach(t => { if (t.type === 'token') tokMap[t.id] = t.attributes || {}; });

    return pools.map(p => {
      const a      = p.attributes || {};
      const baseId = p.relationships?.base_token?.data?.id || '';
      const tok    = tokMap[baseId] || {};
      const ca     = baseId.replace(/^solana_/, '') || null;
      const img    = tok.image_url && tok.image_url !== 'missing.png' ? tok.image_url : null;
      const created = a.pool_created_at ? Date.parse(a.pool_created_at) : null;
      return {
        ca,
        symbol: ((tok.symbol || a.name?.split(' / ')[0] || '?')).slice(0, 12),
        name:   ((tok.name   || tok.symbol || '?')).slice(0, 40),
        image:  img,
        mc:     num(a.market_cap_usd) ?? num(a.fdv_usd),
        liq:    num(a.reserve_in_usd),
        vol24h: num(a.volume_usd?.h24),
        ch24:   a.price_change_percentage?.h24 != null ? Math.round(num(a.price_change_percentage.h24)) : null,
        ageMin: created ? Math.max(0, Math.floor((Date.now() - created) / 60_000)) : null,
        dex:    p.relationships?.dex?.data?.id || null,
      };
    }).filter(c => c.ca).slice(0, limit);
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
  const [trending, fresh, rawBoosts] = await Promise.all([
    fetchGtPools('trending_pools', 12),
    fetchGtPools('new_pools', 12),
    fetchDexBoosts(),
  ]);
  const boosts = await enrichBoosts(rawBoosts);

  // "Top MC" tab — trending pools, biggest first so the label stays honest.
  const topMC = [...trending].sort((a, b) => (b.mc || 0) - (a.mc || 0));

  const data = { topMC, fresh, boosts, ts: Date.now() };
  _cache = { ts: Date.now(), data };
  res.json(data);
};
