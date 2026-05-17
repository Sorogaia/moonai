const { isValidCA, getIP } = require('./_validate');
const { checkRateLimit }   = require('./_ratelimit');

/**
 * /api/token-history — Historical data from day 1
 * Uses GeckoTerminal free API (no key needed) to get daily OHLCV candles
 * from launch. Extracts: real ATH price/MC, launch price/MC, total vol,
 * % change since launch, ATH date.
 */
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const ip      = getIP(req);
  const allowed = await checkRateLimit(ip, { limit: 30, window: 60, prefix: 'history' }).catch(() => true);
  if (!allowed) return res.status(429).json({ error: 'Rate limit exceeded.' });

  const { ca, pair } = req.query;
  if (!ca || !isValidCA(ca)) return res.status(400).json({ error: 'Invalid token address.' });

  try {
    // Step 1 — get pool address from GeckoTerminal if not provided
    let poolAddress = pair && isValidCA(pair) ? pair : null;

    if (!poolAddress) {
      const tokenRes = await fetch(
        `https://api.geckoterminal.com/api/v2/networks/solana/tokens/${ca}/pools?page=1`,
        { headers: { 'Accept': 'application/json' } }
      );
      if (tokenRes.ok) {
        const tokenData = await tokenRes.json();
        // pick highest volume pool
        const pools = tokenData?.data || [];
        if (pools.length > 0) {
          pools.sort((a, b) =>
            parseFloat(b.attributes?.volume_usd?.h24 || 0) -
            parseFloat(a.attributes?.volume_usd?.h24 || 0)
          );
          poolAddress = pools[0]?.attributes?.address || null;
        }
      }
    }

    if (!poolAddress) {
      return res.json({ error: 'No pool found for this token.', noPool: true });
    }

    // Step 2 — fetch daily OHLCV candles (up to 1000 days = full history)
    const ohlcvRes = await fetch(
      `https://api.geckoterminal.com/api/v2/networks/solana/pools/${poolAddress}/ohlcv/day?limit=1000&currency=usd&token=base`,
      { headers: { 'Accept': 'application/json' } }
    );
    if (!ohlcvRes.ok) return res.json({ error: 'OHLCV unavailable.' });

    const ohlcvData = await ohlcvRes.json();
    const candles   = ohlcvData?.data?.attributes?.ohlcv_list || [];
    // Each candle: [timestamp, open, high, low, close, volume]

    if (!candles.length) return res.json({ error: 'No candle data.' });

    // Sort oldest → newest
    candles.sort((a, b) => a[0] - b[0]);

    // Launch candle (first)
    const first       = candles[0];
    const launchTs    = first[0] * 1000;
    const launchPrice = parseFloat(first[1]) || 0; // open of first candle
    const launchVol   = parseFloat(first[5]) || 0;

    // Find ATH (highest 'high' across all candles)
    let athPrice = 0, athTs = 0;
    let totalVol = 0;

    for (const c of candles) {
      const high = parseFloat(c[2]) || 0;
      const vol  = parseFloat(c[5]) || 0;
      totalVol  += vol;
      if (high > athPrice) {
        athPrice = high;
        athTs    = c[0] * 1000;
      }
    }

    // Current price from last candle close
    const lastCandle   = candles[candles.length - 1];
    const currentPrice = parseFloat(lastCandle[4]) || 0;

    // Price change since launch
    const changeSinceLaunch = launchPrice > 0
      ? (((currentPrice - launchPrice) / launchPrice) * 100).toFixed(1)
      : null;

    // ATH % down from ATH
    const downFromAth = athPrice > 0 && currentPrice > 0 && athPrice > currentPrice
      ? (((athPrice - currentPrice) / athPrice) * 100).toFixed(0)
      : null;

    // Days since launch
    const daysSinceLaunch = Math.floor((Date.now() - launchTs) / 86400000);

    res.json({
      launchPrice,
      launchTs,
      daysSinceLaunch,
      athPrice,
      athTs,
      downFromAth,
      totalVol,
      changeSinceLaunch,
      candleCount: candles.length,
      poolAddress,
    });

  } catch (e) {
    res.status(502).json({ error: 'History unavailable.' });
  }
};
