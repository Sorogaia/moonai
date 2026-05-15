const { isValidCA, getIP } = require('./_validate');
const { checkRateLimit }   = require('./_ratelimit');

const HELIUS_KEY = process.env.HELIUS_API_KEY;
const RPC_URL    = () => `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`;

async function rpc(id, method, params) {
  const res = await fetch(RPC_URL(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  });
  return res.json();
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const ip      = getIP(req);
  const allowed = await checkRateLimit(ip, { limit: 60, window: 60, prefix: 'tokeninfo' }).catch(() => true);
  if (!allowed) return res.status(429).json({ error: 'Rate limit exceeded.' });

  const { ca, dev } = req.query;
  if (!ca || !isValidCA(ca))          return res.status(400).json({ error: 'Invalid token address.' });
  if (dev && !isValidCA(dev))          return res.status(400).json({ error: 'Invalid dev address.' });
  if (!HELIUS_KEY)                     return res.status(500).json({ error: 'Service unavailable.' });

  try {
    const calls = [rpc(1, 'getAccountInfo', [ca, { encoding: 'jsonParsed', commitment: 'confirmed' }])];
    if (dev) {
      calls.push(rpc(2, 'getTokenAccountsByOwner', [dev, { mint: ca }, { encoding: 'jsonParsed', commitment: 'confirmed' }]));
    }

    const [mintInfo, devTokenInfo] = await Promise.all(calls);

    const parsed     = mintInfo?.result?.value?.data?.parsed?.info || {};
    const mintAuth   = parsed.mintAuthority   || null;
    const freezeAuth = parsed.freezeAuthority || null;

    let devBalance = null, devPct = null, devSold = false;
    if (dev && devTokenInfo) {
      const accounts = devTokenInfo?.result?.value || [];
      const totalRaw = accounts.reduce((sum, a) =>
        sum + parseFloat(a.account?.data?.parsed?.info?.tokenAmount?.uiAmount || 0), 0);
      devBalance = totalRaw;
      devPct     = ((totalRaw / 1_000_000_000) * 100).toFixed(2);
      devSold    = totalRaw === 0;
    }

    return res.status(200).json({
      mintAuthority:   mintAuth,
      freezeAuthority: freezeAuth,
      mintRevoked:     mintAuth   === null,
      freezeRevoked:   freezeAuth === null,
      devBalance, devPct, devSold,
    });
  } catch {
    return res.status(502).json({ error: 'Unable to fetch token info.' });
  }
};
