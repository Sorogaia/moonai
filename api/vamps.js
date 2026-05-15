/**
 * /api/vamps — Vamp coin detection
 * Searches DexScreener for tokens with the same symbol/name
 * and returns likely copycat launches on Solana.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { ca, symbol, name } = req.query;
  if (!ca || !symbol) return res.status(400).json({ error: 'Missing ca or symbol' });

  try {
    // Search DexScreener for tokens matching the symbol
    const r = await fetch(
      `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(symbol)}`,
      { headers: { 'Accept': 'application/json' } }
    );
    if (!r.ok) return res.json({ vamps: [] });
    const data = await r.json();

    const caLower = ca.toLowerCase();
    const symLower = symbol.toLowerCase();

    const vamps = (data.pairs || [])
      .filter(p =>
        p.chainId === 'solana' &&
        p.baseToken?.address?.toLowerCase() !== caLower &&
        // Must share the same symbol or name (case-insensitive)
        (
          p.baseToken?.symbol?.toLowerCase() === symLower ||
          p.baseToken?.symbol?.toLowerCase().includes(symLower) ||
          p.baseToken?.name?.toLowerCase().includes(symLower)
        ) &&
        // Must have some market activity
        (parseFloat(p.fdv || 0) > 500 || parseFloat(p.marketCap || 0) > 500)
      )
      .map(p => ({
        ca:            p.baseToken.address,
        name:          p.baseToken.name,
        symbol:        p.baseToken.symbol,
        image:         p.info?.imageUrl || null,
        mc:            parseFloat(p.fdv || p.marketCap || 0),
        volume24h:     parseFloat(p.volume?.h24 || 0),
        priceChange24h: parseFloat(p.priceChange?.h24 || 0),
        created:       p.pairCreatedAt || null,
        pairUrl:       p.url || null,
      }))
      // Sort: highest volume first (most active vamps at top)
      .sort((a, b) => b.volume24h - a.volume24h)
      .slice(0, 6);

    res.json({ vamps });
  } catch (e) {
    res.status(500).json({ error: e.message, vamps: [] });
  }
}
