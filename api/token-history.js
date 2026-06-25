const { isValidCA, getIP } = require('./_validate');
const { checkRateLimit }   = require('./_ratelimit');

const HELIUS_KEY = process.env.HELIUS_API_KEY;

/**
 * /api/token-history — Historical data from day 1
 *
 * Pump.fun tokens that migrate to Raydium/pumpswap have TWO pools: the
 * original bonding-curve pool (where they actually launched and often hit
 * their pre-migration ATH) and the current AMM pool. Sorting by current
 * volume puts the new AMM pool first, which means:
 *   - Launch data shows the migration time, not the actual launch
 *   - ATH scan misses any pre-migration high
 *
 * Strategy:
 *   - Find the OLDEST pool (sort by pool_created_at) → use it for launch data
 *   - Always include the oldest pool in the ATH scan set
 *   - Use HOUR resolution candles (1000 hrs = ~41 days) — daily candles
 *     smooth out the intra-day spikes that define memecoin ATHs
 *   - Also fetch DAY candles for the oldest pool, so tokens older than
 *     ~41 days still have full historical coverage for ATH
 */
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://fluxrapp.xyz';

async function fetchOhlcv(poolAddr, timeframe = 'hour') {
  try {
    const r = await fetch(
      `https://api.geckoterminal.com/api/v2/networks/solana/pools/${poolAddr}/ohlcv/${timeframe}?limit=1000&currency=usd&token=base`,
      { headers: { 'Accept': 'application/json' } }
    );
    if (!r.ok) return [];
    const data = await r.json();
    return data?.data?.attributes?.ohlcv_list || [];
  } catch { return []; }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const ip      = getIP(req);
  const allowed = await checkRateLimit(ip, { limit: 30, window: 60, prefix: 'history' }).catch(() => false);
  if (!allowed) return res.status(429).json({ error: 'Rate limit exceeded.' });

  const { ca, pair } = req.query;
  if (!ca || !isValidCA(ca)) return res.status(400).json({ error: 'Invalid token address.' });

  try {
    // ── Step 1: On-chain supply via Helius (parallel-friendly) ────────────
    const supplyPromise = HELIUS_KEY
      ? fetch(`https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0', id: 1,
            method:  'getTokenSupply',
            params:  [ca],
          }),
        }).then(r => r.json()).catch(() => null)
      : Promise.resolve(null);

    // ── Step 2: All pools for this token ──────────────────────────────────
    const tokenRes = await fetch(
      `https://api.geckoterminal.com/api/v2/networks/solana/tokens/${ca}/pools?page=1`,
      { headers: { 'Accept': 'application/json' } }
    );
    if (!tokenRes.ok) return res.json({ error: 'No pool data.', noPool: true });
    const tokenData = await tokenRes.json();
    const pools = tokenData?.data || [];
    if (!pools.length) return res.json({ error: 'No pool found for this token.', noPool: true });

    // ── Step 3: Identify pools ────────────────────────────────────────────
    // OLDEST pool — for launch data. Pump.fun bonding curve pool is older than
    // any Raydium/pumpswap pool created at migration.
    const poolsByAge = [...pools].sort((a, b) =>
      new Date(a.attributes?.pool_created_at || 0).getTime() -
      new Date(b.attributes?.pool_created_at || 0).getTime()
    );
    const oldestPool     = poolsByAge[0];
    const oldestPoolAddr = oldestPool?.attributes?.address;

    // TOP-VOLUME pool — for current price / market cap
    const poolsByVolume = [...pools].sort((a, b) =>
      parseFloat(b.attributes?.volume_usd?.h24 || 0) -
      parseFloat(a.attributes?.volume_usd?.h24 || 0)
    );
    const topPool                = poolsByVolume[0];
    const primaryPool            = (pair && isValidCA(pair)) ? pair : topPool?.attributes?.address || null;
    const currentMcUsd           = parseFloat(topPool?.attributes?.market_cap_usd || topPool?.attributes?.fdv_usd || 0);
    const currentPriceFromPool   = parseFloat(topPool?.attributes?.base_token_price_usd || 0);

    if (!primaryPool) return res.json({ error: 'No pool found.', noPool: true });

    // POOLS TO SCAN for ATH — top 3 by volume PLUS the oldest pool (deduped)
    const scanSet = new Set();
    if (oldestPoolAddr) scanSet.add(oldestPoolAddr);
    for (let i = 0; i < Math.min(poolsByVolume.length, 3); i++) {
      const addr = poolsByVolume[i]?.attributes?.address;
      if (addr) scanSet.add(addr);
    }
    const poolsToScan = [...scanSet];

    // For tokens whose oldest pool was created in the last 24h, the launch
    // spike is sub-hour — fetch MINUTE candles too (1000m ≈ 16.6h) so we
    // don't lose the early-pump ATH inside an averaged hour candle.
    const oldestPoolCreatedAt = oldestPool?.attributes?.pool_created_at
      ? new Date(oldestPool.attributes.pool_created_at).getTime()
      : 0;
    const tokenAgeHrs = oldestPoolCreatedAt > 0 ? (Date.now() - oldestPoolCreatedAt) / 3_600_000 : Infinity;
    const fetchMinute = tokenAgeHrs < 24;

    // ── Step 4: Fetch candles in parallel ─────────────────────────────────
    // HOUR resolution for every scanned pool (high-res for recent intra-day spikes)
    // DAY resolution for the oldest pool only (covers tokens >41 days old + launch ts)
    // MINUTE resolution for every scanned pool IF token is <24h old (catches the early-launch pump)
    const hourPromises   = poolsToScan.map(addr => fetchOhlcv(addr, 'hour'));
    const dayPromise     = oldestPoolAddr ? fetchOhlcv(oldestPoolAddr, 'day')    : Promise.resolve([]);
    const minutePromises = fetchMinute ? poolsToScan.map(addr => fetchOhlcv(addr, 'minute')) : [];
    const supplyJson     = await supplyPromise; // resolve in parallel with the OHLCV fetches
    const [hourResults, dayCandles, minuteResults] = await Promise.all([
      Promise.all(hourPromises),
      dayPromise,
      Promise.all(minutePromises),
    ]);

    // ── Step 5: Resolve supply ────────────────────────────────────────────
    const actualSupply  = parseFloat(supplyJson?.result?.value?.uiAmount || 0);
    const derivedSupply = (currentMcUsd > 0 && currentPriceFromPool > 0)
      ? currentMcUsd / currentPriceFromPool
      : 1_000_000_000;
    const supply = actualSupply > 0 ? actualSupply : derivedSupply;

    // ── Step 6: Scan ALL candles for ATH ──────────────────────────────────
    let athPrice  = 0;
    let athTs     = 0;
    let athSource = null;

    const considerCandles = (candles, source) => {
      for (const c of candles) {
        const high = parseFloat(c[2]) || 0;
        const ts   = parseInt(c[0], 10) * 1000;
        if (high > athPrice && !isNaN(ts) && ts > 0) {
          athPrice  = high;
          athTs     = ts;
          athSource = source;
        }
      }
    };

    // Minute candles first (highest resolution, only present for <24h tokens)
    for (let i = 0; i < minuteResults.length; i++) {
      considerCandles(minuteResults[i] || [], 'minute');
    }
    // Hour candles
    for (let i = 0; i < poolsToScan.length; i++) {
      considerCandles(hourResults[i] || [], 'hour');
    }
    // Day candles for deep history
    considerCandles(dayCandles, 'day');

    // ── Step 7: Launch info from oldest pool ──────────────────────────────
    // Prefer day candles (deeper history). Fall back to hour candles.
    const oldestPoolHourIdx     = poolsToScan.indexOf(oldestPoolAddr);
    const oldestPoolHourCandles = oldestPoolHourIdx >= 0 ? (hourResults[oldestPoolHourIdx] || []) : [];
    const launchCandles = dayCandles.length ? [...dayCandles] : [...oldestPoolHourCandles];
    if (!launchCandles.length) return res.json({ error: 'No candle data.' });

    launchCandles.sort((a, b) => a[0] - b[0]); // oldest first
    const first       = launchCandles[0];
    const launchTs    = first[0] * 1000;
    const launchPrice = parseFloat(first[1]) || 0; // open of first candle = closest to launch
    const launchMc    = launchPrice * supply;

    // ── Step 8: Total volume from oldest pool (full lifetime) ─────────────
    let totalVol = 0;
    for (const c of launchCandles) totalVol += parseFloat(c[5]) || 0;

    // ── Step 9: Current price (from pool data, fall back to last candle) ──
    const lastCandle   = launchCandles[launchCandles.length - 1];
    const currentPrice = currentPriceFromPool || parseFloat(lastCandle[4]) || 0;

    // ── Step 10: Sanity floor — ATH can never be lower than the current value.
    // If GeckoTerminal missed the actual launch spike (common for very-fresh
    // pump.fun bonding-curve trades), the highest candle we found can be
    // *below* what the token is trading at right now. Floor at current so the
    // ATH displayed is at least as high as where price actually is today.
    if (currentPrice > athPrice) {
      athPrice  = currentPrice;
      athTs     = athTs || Date.now();
      athSource = athSource ? athSource + '+current-floor' : 'current-floor';
    }

    // ── Step 11: Derived stats ────────────────────────────────────────────
    let athMc = athPrice * supply;
    // Same floor for MC — protects against supply mismatches
    if (currentMcUsd > athMc) {
      athMc = currentMcUsd;
      athSource = (athSource || '') + '+mc-floor';
    }

    const changeSinceLaunch = launchPrice > 0
      ? (((currentPrice - launchPrice) / launchPrice) * 100).toFixed(1)
      : null;

    const mcChangeSinceLaunch = launchMc > 0 && currentMcUsd > 0
      ? (((currentMcUsd - launchMc) / launchMc) * 100).toFixed(1)
      : null;

    const downFromAth = athPrice > 0 && currentPrice > 0 && athPrice > currentPrice
      ? (((athPrice - currentPrice) / athPrice) * 100).toFixed(0)
      : null;

    const downFromAthMc = athMc > 0 && currentMcUsd > 0 && athMc > currentMcUsd
      ? (((athMc - currentMcUsd) / athMc) * 100).toFixed(0)
      : null;

    const daysSinceLaunch = Math.floor((Date.now() - launchTs) / 86400000);

    res.json({
      // ATH
      athPrice, athMc, athTs, athSource,
      downFromAth, downFromAthMc,
      // Launch
      launchPrice, launchMc, launchTs, daysSinceLaunch,
      // Changes
      changeSinceLaunch, mcChangeSinceLaunch,
      // Volume
      totalVol,
      // Meta
      candleCount:   launchCandles.length,
      poolAddress:   primaryPool,
      launchPool:    oldestPoolAddr,
      poolsScanned:  poolsToScan.length,
      tokenAgeHrs:   Number.isFinite(tokenAgeHrs) ? Math.round(tokenAgeHrs * 10) / 10 : null,
      usedMinute:    fetchMinute,
      supply,
      supplySource:  actualSupply > 0 ? 'helius' : 'derived',
    });

  } catch {
    res.status(502).json({ error: 'History unavailable.' });
  }
};
