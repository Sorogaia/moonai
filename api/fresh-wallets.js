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

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://fluxrapp.xyz';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const ip      = getIP(req);
  const allowed = await checkRateLimit(ip, { limit: 60, window: 60, prefix: 'freshw' }).catch(() => false);
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
        // Fetch 50 sigs — if wallet has fewer than 50 total txns, we see ALL of its history.
        // The LAST signature in this list is the wallet's OLDEST known transaction.
        // With limit:1 we only got the most recent tx (the buy itself) which made
        // every buyer look "fresh" — that was the bug.
        const sigsData = await rpc('fs_' + owner.slice(0, 8), 'getSignaturesForAddress', [
          owner, { limit: 50, commitment: 'confirmed' },
        ]);
        const sigs = sigsData.result || [];
        if (!sigs.length) return { owner, fresh: false };

        // If wallet has < 50 total txns, we have its complete history.
        // The oldest tx timestamp is its effective creation date.
        const totalTxns   = sigs.length;
        const oldest      = sigs[sigs.length - 1]; // oldest in 50-tx window
        const walletOldest = (oldest.blockTime || 0) * 1000;

        // Fresh = wallet was created within 30 days before or after token launch
        // AND has fewer than 50 total transactions (genuinely new wallet).
        // A veteran wallet with 5000 txns should NEVER be called fresh.
        const ageRelativeToToken = walletOldest - tokenCreatedAt; // positive = wallet older than token
        const isFresh = totalTxns < 50 && Math.abs(ageRelativeToToken) < (30 * 24 * 3600 * 1000);
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
