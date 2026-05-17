const { isValidCA, getIP } = require('./_validate');
const { checkRateLimit }   = require('./_ratelimit');

const HELIUS_KEY  = process.env.HELIUS_API_KEY;
const RPC_URL     = () => `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`;
const ENHANCED    = (wallet) => `https://api.helius.xyz/v0/addresses/${wallet}/transactions?api-key=${HELIUS_KEY}&limit=50`;

async function rpc(id, method, params) {
  const res = await fetch(RPC_URL(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  });
  return res.json();
}

/**
 * For a given wallet + mint, scan recent transactions to extract:
 * - totalBought  (tokens received)
 * - totalSold    (tokens sent out)
 * - solSpent     (SOL spent buying)
 * - solReceived  (SOL received selling)
 * - walletAge    (days since oldest tx in batch)
 * - isFresh      (wallet created very recently)
 * - isVeteran    (wallet active for 180+ days)
 */
async function getWalletActivity(wallet, mint) {
  try {
    const res = await fetch(ENHANCED(wallet), { headers: { 'Accept': 'application/json' } });
    if (!res.ok) return null;
    const txs = await res.json();
    if (!Array.isArray(txs) || txs.length === 0) return { totalBought: 0, totalSold: 0, solSpent: 0, solReceived: 0, walletAge: null, isFresh: false, isVeteran: false, txCount: 0 };

    let totalBought = 0, totalSold = 0, solSpent = 0, solReceived = 0;

    for (const tx of txs) {
      const transfers = tx.tokenTransfers || [];
      for (const t of transfers) {
        if (t.mint !== mint) continue;
        // tokenAmount from Helius enhanced API is the human-readable UI amount
        const amount = parseFloat(t.tokenAmount) || 0;
        if (amount <= 0) continue;

        if (t.toUserAccount === wallet) {
          // received tokens = BUY
          totalBought += amount;
          // find SOL leaving this wallet in the same tx
          const solOut = (tx.nativeTransfers || [])
            .filter(n => n.fromUserAccount === wallet)
            .reduce((s, n) => s + (parseInt(n.amount) || 0), 0);
          solSpent += solOut / 1e9;
        } else if (t.fromUserAccount === wallet) {
          // sent tokens = SELL
          totalSold += amount;
          // find SOL arriving to this wallet in the same tx
          const solIn = (tx.nativeTransfers || [])
            .filter(n => n.toUserAccount === wallet)
            .reduce((s, n) => s + (parseInt(n.amount) || 0), 0);
          solReceived += solIn / 1e9;
        }
      }
    }

    // Wallet age from oldest tx in the 50-tx window
    const oldest = txs[txs.length - 1];
    const oldestTs = oldest?.timestamp || 0;
    const walletAge = oldestTs > 0 ? Math.floor((Date.now() / 1000 - oldestTs) / 86400) : null;

    // Fresh = wallet was first seen less than 30 days ago AND has few total txs
    const isFresh   = walletAge !== null && walletAge < 30 && txs.length < 40;
    // Veteran = oldest tx we can see is 180+ days ago
    const isVeteran = walletAge !== null && walletAge >= 180;

    return {
      totalBought, totalSold,
      solSpent:    parseFloat(solSpent.toFixed(4)),
      solReceived: parseFloat(solReceived.toFixed(4)),
      walletAge, isFresh, isVeteran,
      txCount: txs.length,
      hasSold: totalSold > 0,
      soldPct: totalBought > 0 ? Math.round((totalSold / totalBought) * 100) : 0,
    };
  } catch {
    return null;
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const ip      = getIP(req);
  const allowed = await checkRateLimit(ip, { limit: 30, window: 60, prefix: 'holders' }).catch(() => true);
  if (!allowed) return res.status(429).json({ error: 'Rate limit exceeded.' });

  const { ca } = req.query;
  if (!ca || !isValidCA(ca)) return res.status(400).json({ error: 'Invalid token address.' });
  if (!HELIUS_KEY)            return res.status(500).json({ error: 'Service unavailable.' });

  try {
    // Step 1: get top 10 token accounts + supply
    const [largestData, supplyData] = await Promise.all([
      rpc(1, 'getTokenLargestAccounts', [ca, { commitment: 'confirmed' }]),
      rpc(2, 'getTokenSupply',          [ca, { commitment: 'confirmed' }]),
    ]);

    // Solana returns up to 20 largest token accounts — use ALL 20 before dedup.
    // A wallet with 2 accounts at positions 11 + 15 combined might be top-5.
    const accounts    = largestData.result?.value?.slice(0, 20) || [];
    const totalSupply = parseFloat(supplyData.result?.value?.uiAmount) || 0;
    if (accounts.length === 0) return res.status(200).json({ holders: [], totalSupply });

    // Step 2: resolve token account → owner wallet
    const tokenAddresses = accounts.map(a => a.address);
    const infoData = await rpc(3, 'getMultipleAccounts', [
      tokenAddresses,
      { encoding: 'jsonParsed', commitment: 'confirmed' },
    ]);
    const infos = infoData.result?.value || [];

    // Resolve token account → owner, then DEDUPLICATE by wallet.
    // A wallet can have multiple token accounts — merge their amounts.
    const rawHolders = accounts.map((acct, i) => ({
      owner:  infos[i]?.data?.parsed?.info?.owner || acct.address,
      amount: parseFloat(acct.uiAmount) || 0,
    }));

    const ownerMap = {};
    for (const { owner, amount } of rawHolders) {
      ownerMap[owner] = (ownerMap[owner] || 0) + amount;
    }
    const holders = Object.entries(ownerMap)
      .map(([owner, amount]) => ({
        owner,
        tokenAccount: owner, // best proxy when deduplicated
        amount,
        pct: totalSupply > 0 ? (amount / totalSupply) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    // Step 3: enrich each holder with wallet activity (all in parallel)
    const activityResults = await Promise.allSettled(
      holders.map(h => getWalletActivity(h.owner, ca))
    );

    const enriched = holders.map((h, i) => {
      const act = activityResults[i].status === 'fulfilled' ? activityResults[i].value : null;
      return {
        ...h,
        totalBought:  act?.totalBought  ?? 0,
        totalSold:    act?.totalSold    ?? 0,
        solSpent:     act?.solSpent     ?? 0,
        solReceived:  act?.solReceived  ?? 0,
        hasSold:      act?.hasSold      ?? null,
        soldPct:      act?.soldPct      ?? 0,
        walletAge:    act?.walletAge    ?? null,
        isFresh:      act?.isFresh      ?? false,
        isVeteran:    act?.isVeteran    ?? false,
        txCount:      act?.txCount      ?? 0,
      };
    });

    return res.status(200).json({ holders: enriched, totalSupply });
  } catch {
    return res.status(502).json({ error: 'Unable to fetch holder data.' });
  }
};
