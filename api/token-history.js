const { isValidCA, getIP } = require('./_validate');
const { checkRateLimit }   = require('./_ratelimit');

const HELIUS_KEY = process.env.HELIUS_API_KEY;

/**
 * /api/token-history — Historical data from day 1
 *
 * Supply accuracy chain (highest priority first):
 *   1. Helius getTokenSupply  — exact on-chain circulating supply
 *   2. currentMcUsd / price   — derived from GeckoTerminal pool data
 *   3. 1,000,000,000          — pump.fun fixed-supply fallback
 *
 * ATH accuracy:
 *   - Scans OHLCV for the top 3 pools by 24h volume, takes the highest
 *     "high" candle across all pools so we don't miss a peak that happened
 *     on a different pool.
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
    // ── Step 1: Actual on-chain supply via Helius ──────────────────────────
    let actualSupply = 0;
    if (HELIUS_KEY) {
      try {
        const supplyRes = await fetch(
          `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`,
          {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0', id: 1,
              method:  'getTokenSupply',
              params:  [ca],
            }),
          }
        );
        const supplyJson = await supplyRes.json();
        // uiAmount already accounts for decimals
        actualSupply = parseFloat(supplyJson?.result?.value?.uiAmount || 0);
      } catch { /* non-fatal */ }
    }

    // ── Step 2: Pools — pick primary pool + collect top 3 for ATH scan ────
    let primaryPool   = pair && isValidCA(pair) ? pair : null;
    let currentMcUsd  = 0;
    let currentPriceFromPool = 0;
    const poolsToScan = [];           // up to 3 pool addresses for OHLCV scan

    const tokenRes = await fetch(
      `https://api.geckoterminal.com/api/v2/networks/solana/tokens/${ca}/pools?page=1`,
      { headers: { 'Accept': 'application/json' } }
    );
    if (tokenRes.ok) {
      const tokenData = await tokenRes.json();
      const pools = tokenData?.data || [];
      if (pools.length > 0) {
        // Sort by 24h volume descending
        pools.sort((a, b) =>
          parseFloat(b.attributes?.volume_usd?.h24 || 0) -
          parseFloat(a.attributes?.volume_usd?.h24 || 0)
        );

        // Primary pool (highest current volume)
        const best = pools[0];
        if (!primaryPool) primaryPool = best?.attributes?.address || null;
        currentMcUsd         = parseFloat(best?.attributes?.market_cap_usd || best?.attributes?.fdv_usd || 0);
        currentPriceFromPool = parseFloat(best?.attributes?.base_token_price_usd || 0);

        // Collect up to 3 pools for ATH scan (cover different historical epochs)
        for (let i = 0; i < Math.min(pools.length, 3); i++) {
          const addr = pools[i]?.attributes?.address;
          if (addr) poolsToScan.push(addr);
        }
        // Always include the primary pool first if a pair was passed in
        if (primaryPool && !poolsToScan.includes(primaryPool)) {
          poolsToScan.unshift(primaryPool);
        }
      }
    }

    if (!primaryPool) {
      return res.json({ error: 'No pool found for this token.', noPool: true });
    }

    // ── Step 3: Resolve supply ─────────────────────────────────────────────
    // Priority: on-chain > derived > 1B fallback
    const derivedSupply = (currentMcUsd > 0 && currentPriceFromPool > 0)
      ? currentMcUsd / currentPriceFromPool
      : 1_000_000_000;

    const supply = actualSupply > 0 ? actualSupply : derivedSupply;

    // ── Step 4: Scan OHLCV for each pool, accumulate highest ATH ──────────
    // Deduplicate pool list
    const uniquePools = [...new Set(poolsToScan)];

    let allCandles   = [];   // candles from the primary pool (for launch/vol)
    let athPrice     = 0;
    let athTs        = 0;
    let totalVol     = 0;
    let primaryLoaded = false;

    await Promise.all(uniquePools.map(async (poolAddr) => {
      try {
        const ohlcvRes = await fetch(
          `https://api.geckoterminal.com/api/v2/networks/solana/pools/${poolAddr}/ohlcv/day?limit=1000&currency=usd&token=base`,
          { headers: { 'Accept': 'application/json' } }
        );
        if (!ohlcvRes.ok) return;

        const ohlcvData = await ohlcvRes.json();
        const candles   = ohlcvData?.data?.attributes?.ohlcv_list || [];
        if (!candles.length) return;

        // Keep primary pool candles for launch date / total volume
        if (poolAddr === uniquePools[0] && !primaryLoaded) {
          allCandles    = candles;
          primaryLoaded = true;
        }

        // Find ATH across this pool's history
        for (const c of candles) {
          const high = parseFloat(c[2]) || 0;
          const ts   = parseInt(c[0], 10) * 1000;
          if (high > athPrice && !isNaN(ts) && ts > 0) {
            athPrice = high;
            athTs    = ts;
          }
        }
      } catch { /* skip failing pool */ }
    }));

    if (!allCandles.length) return res.json({ error: 'No candle data.' });

    // Sort primary candles oldest → newest for launch / vol calculations
    allCandles.sort((a, b) => a[0] - b[0]);

    // Sum volume from primary pool candles
    for (const c of allCandles) {
      totalVol += parseFloat(c[5]) || 0;
    }

    // Launch data (first candle of primary pool)
    const first       = allCandles[0];
    const launchTs    = first[0] * 1000;
    const launchPrice = parseFloat(first[1]) || 0;   // open of first candle
    const launchMc    = launchPrice * supply;

    // ATH MC
    const athMc = athPrice * supply;

    // Current price from last candle close (primary pool)
    const lastCandle   = allCandles[allCandles.length - 1];
    const currentPrice = parseFloat(lastCandle[4]) || 0;

    // Price change since launch
    const changeSinceLaunch = launchPrice > 0
      ? (((currentPrice - launchPrice) / launchPrice) * 100).toFixed(1)
      : null;

    // MC change since launch
    const mcChangeSinceLaunch = launchMc > 0 && currentMcUsd > 0
      ? (((currentMcUsd - launchMc) / launchMc) * 100).toFixed(1)
      : null;

    // % down from ATH price
    const downFromAth = athPrice > 0 && currentPrice > 0 && athPrice > currentPrice
      ? (((athPrice - currentPrice) / athPrice) * 100).toFixed(0)
      : null;

    // % down from ATH MC
    const downFromAthMc = athMc > 0 && currentMcUsd > 0 && athMc > currentMcUsd
      ? (((athMc - currentMcUsd) / athMc) * 100).toFixed(0)
      : null;

    // Days since launch
    const daysSinceLaunch = Math.floor((Date.now() - launchTs) / 86400000);

    res.json({
      // ATH
      athPrice,
      athMc,
      athTs,
      downFromAth,
      downFromAthMc,
      // Launch
      launchPrice,
      launchMc,
      launchTs,
      daysSinceLaunch,
      // Changes
      changeSinceLaunch,
      mcChangeSinceLaunch,
      // Volume
      totalVol,
      // Meta
      candleCount: allCandles.length,
      poolAddress: primaryPool,
      supply,
      supplySource: actualSupply > 0 ? 'helius' : 'derived',
    });

  } catch (e) {
    res.status(502).json({ error: 'History unavailable.' });
  }
};
