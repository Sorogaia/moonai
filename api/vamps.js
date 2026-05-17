const { isValidCA, isValidSymbol, getIP } = require('./_validate');
const { checkRateLimit }   = require('./_ratelimit');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const ip      = getIP(req);
  const allowed = await checkRateLimit(ip, { limit: 30, window: 60, prefix: 'vamps' }).catch(() => true);
  if (!allowed) return res.status(429).json({ error: 'Rate limit exceeded.' });

  const { ca, symbol, name } = req.query;
  if (!ca || !isValidCA(ca))         return res.status(400).json({ error: 'Invalid token address.' });
  if (!symbol || !isValidSymbol(symbol)) return res.status(400).json({ error: 'Invalid symbol.' });

  try {
    const r = await fetch(
      `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(symbol)}`,
      { headers: { 'Accept': 'application/json' } }
    );
    if (!r.ok) return res.json({ vamps: [] });

    const data    = await r.json();
    const caLower = ca.toLowerCase();
    const symLower = symbol.toLowerCase();

    const vamps = (data.pairs || [])
      .filter(p =>
        p.chainId === 'solana' &&
        p.baseToken?.address?.toLowerCase() !== caLower &&
        (
          p.baseToken?.symbol?.toLowerCase() === symLower ||
          p.baseToken?.symbol?.toLowerCase().includes(symLower) ||
          p.baseToken?.name?.toLowerCase().includes(symLower)
        ) &&
        (parseFloat(p.fdv || 0) > 500 || parseFloat(p.marketCap || 0) > 500)
      )
      .map(p => ({
        ca:             p.baseToken.address,
        name:           p.baseToken.name,
        symbol:         p.baseToken.symbol,
        image:          p.info?.imageUrl || null,
        mc:             parseFloat(p.fdv || p.marketCap || 0),
        volume24h:      parseFloat(p.volume?.h24 || 0),
        priceChange24h: parseFloat(p.priceChange?.h24 || 0),
        created:        p.pairCreatedAt || null,
      }))
      .sort((a, b) => b.volume24h - a.volume24h)
      .slice(0, 6);

    res.json({ vamps });
  } catch {
    res.status(502).json({ error: 'Unable to scan for similar tokens.' });
  }
};
