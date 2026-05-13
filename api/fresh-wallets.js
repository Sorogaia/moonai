/**
 * MoonAi — Fresh Wallet Detection
 * Checks what % of top holders are newly created wallets.
 * Fresh wallets = created within 7 days of the token launch.
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

  const { ca, created } = req.query;
  if (!ca)         return res.status(400).json({ error: 'Missing ca' });
  if (!HELIUS_KEY) return res.status(500).json({ error: 'Missing HELIUS_API_KEY' });

  try {
    // Get top 10 holders
    const [largestData, supplyData] = await Promise.all([
      rpc(1, 'getTokenLargestAccounts', [ca, { commitment: 'confirmed' }]),
      rpc(2, 'getTokenSupply',          [ca, { commitment: 'confirmed' }]),
    ]);

    const accounts    = largestData.result?.value?.slice(0, 10) || [];
    const totalSupply = parseFloat(supplyData.result?.value?.uiAmount) || 1_000_000_000;
    if (!accounts.length) return res.status(200).json({ freshPct: 0, freshCount: 0, total: 0 });

    // Resolve token accounts → owners
    const tokenAddrs = accounts.map(a => a.address);
    const infoData   = await rpc(3, 'getMultipleAccounts', [
      tokenAddrs,
      { encoding: 'jsonParsed', commitment: 'confirmed' },
    ]);
    const infos  = infoData.result?.value || [];
    const owners = infos.map((info, i) => ({
      owner:  info?.data?.parsed?.info?.owner || accounts[i].address,
      amount: parseFloat(accounts[i].uiAmount) || 0,
    }));

    // Check when each owner wallet was first active
    const tokenCreatedAt = created ? parseInt(created) : Date.now() - 7 * 24 * 3600 * 1000;
    const freshWindow    = 7 * 24 * 3600 * 1000; // 7 days in ms

    const walletChecks = await Promise.allSettled(
      owners.map(async ({ owner }) => {
        const sigsData = await rpc('fs_' + owner.slice(0, 8), 'getSignaturesForAddress', [
          owner,
          { limit: 1, commitment: 'confirmed' },
        ]);
        const sigs = sigsData.result || [];
        if (!sigs.length) return { owner, fresh: false };
        // getSignaturesForAddress returns newest first; last item = oldest tx
        const oldest = sigs[sigs.length - 1];
        const walletCreated = (oldest.blockTime || 0) * 1000;
        // Fresh if wallet was created close to when the token launched
        const isFresh = Math.abs(walletCreated - tokenCreatedAt) < freshWindow;
        return { owner, fresh: isFresh, walletCreated };
      })
    );

    const results   = walletChecks.map(r => r.status === 'fulfilled' ? r.value : { fresh: false });
    const freshCount = results.filter(r => r.fresh).length;
    const freshPct   = owners.length > 0 ? ((freshCount / owners.length) * 100).toFixed(1) : 0;

    return res.status(200).json({
      freshPct,
      freshCount,
      total: owners.length,
    });

  } catch (e) {
    return res.status(502).json({ error: `Fresh wallet error: ${e.message}` });
  }
};
