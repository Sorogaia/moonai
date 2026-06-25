const { isValidCA, isValidSymbol, getIP, safeImageUrl } = require('./_validate');
const { checkRateLimit }        = require('./_ratelimit');
const { isSuspended, check }    = require('./_anomaly');

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://fluxrapp.xyz';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const ip      = getIP(req);
  const allowed = await checkRateLimit(ip, { limit: 30, window: 60, prefix: 'vamps' }).catch(() => false);
  if (!allowed) return res.status(429).json({ error: 'Rate limit exceeded.' });

  if (await isSuspended('dexscreener').catch(() => false)) {
    return res.json({ vamps: [] });
  }

  const { ca, symbol } = req.query;
  if (!ca || !isValidCA(ca))             return res.status(400).json({ error: 'Invalid token address.' });
  if (!symbol || !isValidSymbol(symbol)) return res.status(400).json({ error: 'Invalid symbol.' });

  try {
    const r = await fetch(
      `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(symbol)}`,
      { headers: { 'Accept': 'application/json' } }
    );
    if (!r.ok) return res.json({ vamps: [] });

    const data = await r.json();

    // Schema validation — flag anomalous DexScreener responses
    await check('dexscreener', Array.isArray(data.pairs), 'pairs', data.pairs);

    const caLower  = ca.toLowerCase();
    const symLower = symbol.toLowerCase();

    // Vamp = a coin actively trying to ride the original's brand. Strict matching
    // avoids false positives like "WIFI" matching "WIF" or "DOGEFATHER" matching "DOGE".
    // Match rules (any one is sufficient):
    //   1. EXACT symbol match (case-insensitive)            — most common vamp pattern
    //   2. Symbol VARIANT — ticker + version suffix like
    //      BONK2, BONKII, BONKv2, BONK2.0, BONKX, BONKPRO   — "version copy" pattern
    //   3. Symbol prefix — original is a prefix of vamp's
    //      ticker AND the suffix is ≤3 chars (e.g. WIFY, DOGEAI)
    //   4. Name CONTAINS the symbol as a whole word         — "$BONK Coin", "$WIF World"
    // Plus: pair MC > $5K to filter dust copies that nobody is trading.
    const symEsc = symLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const variantRe = new RegExp('^' + symEsc + '(?:[0-9]+|v[0-9]+|i+|[xz]|pro|max|\\.[0-9])$', 'i');
    const prefixRe  = new RegExp('^' + symEsc + '.{1,3}$', 'i');
    const nameWordRe = new RegExp('(^|[^a-z0-9])' + symEsc + '($|[^a-z0-9])', 'i');

    const vamps = (data.pairs || [])
      .filter(p => {
        if (p.chainId !== 'solana') return false;
        const baseCa  = p.baseToken?.address?.toLowerCase();
        const baseSym = (p.baseToken?.symbol || '').toLowerCase();
        const baseNam = (p.baseToken?.name   || '');
        if (!baseCa || baseCa === caLower) return false;
        if (!baseSym && !baseNam) return false;
        const mc = parseFloat(p.fdv || p.marketCap || 0);
        if (mc < 5000) return false;
        const exact   = baseSym === symLower;
        const variant = !exact && variantRe.test(baseSym);
        const prefix  = !exact && !variant && prefixRe.test(baseSym);
        const nameHit = !exact && nameWordRe.test(baseNam);
        return exact || variant || prefix || nameHit;
      })
      // Dedup by CA — the search endpoint sometimes returns multiple pairs
      // for the same base token (one per pool). Keep the highest-volume one.
      .reduce((acc, p) => {
        const baseCa = p.baseToken.address;
        const cur = acc.get(baseCa);
        const vol = parseFloat(p.volume?.h24 || 0);
        if (!cur || vol > cur._vol) acc.set(baseCa, Object.assign({}, p, { _vol: vol }));
        return acc;
      }, new Map())
      .values();

    const vampList = [...vamps]
      .map(p => ({
        ca:             p.baseToken.address,
        name:           p.baseToken.name,
        symbol:         p.baseToken.symbol,
        image:          safeImageUrl(p.info?.imageUrl),
        mc:             parseFloat(p.fdv || p.marketCap || 0),
        volume24h:      parseFloat(p.volume?.h24 || 0),
        priceChange24h: parseFloat(p.priceChange?.h24 || 0),
        created:        p.pairCreatedAt || null,
      }))
      .sort((a, b) => b.volume24h - a.volume24h)
      .slice(0, 6);

    res.json({ vamps: vampList });
  } catch {
    res.status(502).json({ error: 'Unable to scan for similar tokens.' });
  }
};
