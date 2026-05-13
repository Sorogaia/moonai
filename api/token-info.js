/**
 * MoonAi — Token Info
 * Returns mint authority, freeze authority, and dev wallet token balance.
 */

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

  const { ca, dev } = req.query;
  if (!ca)         return res.status(400).json({ error: 'Missing ca parameter' });
  if (!HELIUS_KEY) return res.status(500).json({ error: 'Missing HELIUS_API_KEY' });

  try {
    const calls = [
      rpc(1, 'getAccountInfo', [ca, { encoding: 'jsonParsed', commitment: 'confirmed' }]),
    ];

    if (dev) {
      calls.push(
        rpc(2, 'getTokenAccountsByOwner', [
          dev,
          { mint: ca },
          { encoding: 'jsonParsed', commitment: 'confirmed' },
        ])
      );
    }

    const [mintInfo, devTokenInfo] = await Promise.all(calls);

    // Mint & freeze authority
    const parsed      = mintInfo?.result?.value?.data?.parsed?.info || {};
    const mintAuth    = parsed.mintAuthority   || null;
    const freezeAuth  = parsed.freezeAuthority || null;
    const decimals    = parsed.decimals ?? 6;

    // Dev wallet token balance
    let devBalance    = null;
    let devPct        = null;
    let devSold       = false;

    if (dev && devTokenInfo) {
      const accounts  = devTokenInfo?.result?.value || [];
      const totalRaw  = accounts.reduce((sum, a) => {
        return sum + parseFloat(a.account?.data?.parsed?.info?.tokenAmount?.uiAmount || 0);
      }, 0);
      devBalance = totalRaw;
      devPct     = ((totalRaw / 1_000_000_000) * 100).toFixed(2);
      devSold    = totalRaw === 0;
    }

    return res.status(200).json({
      mintAuthority:   mintAuth,
      freezeAuthority: freezeAuth,
      mintRevoked:     mintAuth   === null,
      freezeRevoked:   freezeAuth === null,
      devBalance,
      devPct,
      devSold,
    });

  } catch (e) {
    return res.status(502).json({ error: `Token info error: ${e.message}` });
  }
};
