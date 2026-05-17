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
  const allowed = await checkRateLimit(ip, { limit: 60, window: 60, prefix: 'freshw' }).catch(() => true);
  if (!allowed) return res.status(429).json({ error: 'Rate limit exceeded.' });

  const { ca, created } = req.query;
  if (!ca || !isValidCA(ca)) return res.status(400).json({ error: 'Invalid token address.' });
  if (!HELIUS_KEY)            return res.status(500).json({ error: 'Service unavailable.' });

  try {
    const [largestData, supplyData] = await Promise.all([
      rpc(1, 'getTokenLargestAccounts', [ca, { commitment: 'confirmed' }]),
      rpc(2, 'getTokenSupply',          [ca, { commitment: 'confirmed' }]),
    ]);

    const accounts    = largestData.result?.value?.slice(0, 10) || [];
    const totalSupply = parseFloat(supplyData.result?.value?.uiAmount) || 1_000_000_000;
    if (!accounts.length) return res.status(200).json({ freshPct: 0, freshCount: 0, total: 0 });

    const tokenAddrs = accounts.map(a => a.address);
    const infoData   = await rpc(3, 'getMultipleAccounts', [tokenAddrs, { encoding: 'jsonParsed', commitment: 'confirmed' }]);
    const infos      = infoData.result?.value || [];
    const owners     = infos.map((info, i) => ({
      owner:  info?.data?.parsed?.info?.owner || accounts[i].address,
      amount: parseFloat(accounts[i].uiAmount) || 0,
    }));

    const rawTs = created ? parseInt(created, 10) : 0;
    const tokenCreatedAt = (rawTs > 0 && rawTs <= Date.now())
      ? rawTs
      : Date.now() - 7 * 24 * 3600 * 1000;
    const freshWindow    = 7 * 24 * 3600 * 1000;

    const walletChecks = await Promise.allSettled(
      owners.map(async ({ owner }) => {
        const sigsData = await rpc('fs_' + owner.slice(0, 8), 'getSignaturesForAddress', [
          owner, { limit: 1, commitment: 'confirmed' },
        ]);
        const sigs = sigsData.result || [];
        if (!sigs.length) return { owner, fresh: false };
        const oldest      = sigs[sigs.length - 1];
        const walletCreated = (oldest.blockTime || 0) * 1000;
        const isFresh     = Math.abs(walletCreated - tokenCreatedAt) < freshWindow;
        return { owner, fresh: isFresh };
      })
    );

    const results    = walletChecks.map(r => r.status === 'fulfilled' ? r.value : { fresh: false });
    const freshCount = results.filter(r => r.fresh).length;
    const freshPct   = owners.length > 0 ? ((freshCount / owners.length) * 100).toFixed(1) : 0;

    return res.status(200).json({ freshPct, freshCount, total: owners.length });
  } catch {
    return res.status(502).json({ error: 'Unable to fetch wallet data.' });
  }
};
