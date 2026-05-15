const { isValidCA, getIP } = require('./_validate');
const { checkRateLimit }   = require('./_ratelimit');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const ip      = getIP(req);
  const allowed = await checkRateLimit(ip, { limit: 30, window: 60, prefix: 'devhist' }).catch(() => true);
  if (!allowed) return res.status(429).json({ error: 'Rate limit exceeded.' });

  const { dev } = req.query;
  if (!dev || !isValidCA(dev)) return res.status(400).json({ error: 'Invalid dev address.' });

  try {
    const pumpRes = await fetch(
      `https://frontend-api.pump.fun/coins/user-created-coins/${dev}?limit=10&offset=0&sort=created_timestamp&order=DESC&includeNsfw=false`,
      { headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' } }
    );

    if (!pumpRes.ok) return res.json({ tokens: [], badge: 'UNKNOWN', total: 0, alive: 0, dead: 0, bonded: 0 });

    const coins = await pumpRes.json();
    if (!Array.isArray(coins) || coins.length === 0) {
      return res.json({ tokens: [], badge: 'NEW_DEV', total: 0, alive: 0, dead: 0, bonded: 0 });
    }

    const tokens = await Promise.all(
      coins.slice(0, 8).map(async t => {
        const ca = t.mint;
        let mc = 0, alive = false;
        try {
          const dexRes = await fetch(
            `https://api.dexscreener.com/latest/dex/tokens/${ca}`,
            { headers: { 'Accept': 'application/json' } }
          );
          if (dexRes.ok) {
            const dexData = await dexRes.json();
            const pair    = dexData?.pairs?.[0];
            if (pair) {
              mc    = parseFloat(pair.fdv || pair.marketCap || 0);
              alive = mc > 1000;
            }
          }
        } catch {}

        const bonded = !!(t.complete);
        if (bonded) alive = true;

        return {
          ca,
          name:    t.name    || '—',
          symbol:  t.symbol  || '—',
          image:   t.image_uri || null,
          mc, bonded, alive,
          created: t.created_timestamp ? t.created_timestamp * 1000 : null,
        };
      })
    );

    const total        = tokens.length;
    const alive_count  = tokens.filter(t => t.alive).length;
    const bonded_count = tokens.filter(t => t.bonded).length;
    const dead_count   = total - alive_count;
    const rug_rate     = total > 0 ? dead_count / total : 0;

    let badge = 'UNKNOWN';
    if (total === 0)          badge = 'NEW_DEV';
    else if (rug_rate >= 0.7) badge = 'SERIAL_RUGGER';
    else if (rug_rate >= 0.4) badge = 'MIXED';
    else if (bonded_count >= Math.ceil(total * 0.5)) badge = 'BUILDER';
    else badge = 'CLEAN';

    res.json({ tokens, badge, total, alive: alive_count, dead: dead_count, bonded: bonded_count });
  } catch {
    res.status(502).json({ error: 'Unable to fetch dev history.', tokens: [], badge: 'UNKNOWN', total: 0, alive: 0, dead: 0, bonded: 0 });
  }
};
