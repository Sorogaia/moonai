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

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://moonaiapp.xyz';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const ip      = getIP(req);
  const allowed = await checkRateLimit(ip, { limit: 60, window: 60, prefix: 'tokeninfo' }).catch(() => false);
  if (!allowed) return res.status(429).json({ error: 'Rate limit exceeded.' });

  const { ca, dev } = req.query;
  if (!ca || !isValidCA(ca))  return res.status(400).json({ error: 'Invalid token address.' });
  if (dev && !isValidCA(dev)) return res.status(400).json({ error: 'Invalid dev address.' });
  if (!HELIUS_KEY)             return res.status(500).json({ error: 'Service unavailable.' });

  try {
    // Phase 1: mint info + on-chain supply in parallel
    const [mintInfo, supplyData] = await Promise.all([
      rpc(1, 'getAccountInfo',     [ca, { encoding: 'jsonParsed', commitment: 'confirmed' }]),
      rpc('sup', 'getTokenSupply', [ca, { commitment: 'confirmed' }]),
    ]);

    const parsed     = mintInfo?.result?.value?.data?.parsed?.info || {};
    const mintAuth   = parsed.mintAuthority   || null;
    const freezeAuth = parsed.freezeAuthority || null;

    // Use real on-chain supply — critical for non-pump.fun tokens
    const actualSupply = parseFloat(supplyData?.result?.value?.uiAmount || 0) || 1_000_000_000;

    // Phase 2: dev token accounts.
    // Use explicit dev param if provided; otherwise fall back to mint authority (the on-chain
    // creator for non-pump.fun tokens). If mint authority is revoked (null) and no dev param,
    // we have no way to identify the dev wallet — skip the lookup.
    const devToQuery = dev || mintAuth;
    let devBalance = null, devPct = null, devSold = false;

    if (devToQuery) {
      const devTokenInfo = await rpc(2, 'getTokenAccountsByOwner', [
        devToQuery, { mint: ca }, { encoding: 'jsonParsed', commitment: 'confirmed' },
      ]);
      const accounts = devTokenInfo?.result?.value || [];
      const totalRaw = accounts.reduce((sum, a) =>
        sum + parseFloat(a.account?.data?.parsed?.info?.tokenAmount?.uiAmount || 0), 0);
      devBalance = totalRaw;
      devPct     = actualSupply > 0 ? ((totalRaw / actualSupply) * 100).toFixed(2) : '0.00';
      // < 1 full token = effectively sold (handles dust left over from sell txns)
      devSold    = totalRaw < 1;
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
