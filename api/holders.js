const HELIUS_KEY = process.env.HELIUS_API_KEY;
const RPC_URL   = () => `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`;

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

  const { ca } = req.query;
  if (!ca) return res.status(400).json({ error: 'Missing ca parameter' });
  if (!HELIUS_KEY) return res.status(500).json({ error: 'Missing HELIUS_API_KEY' });

  try {
    // Fetch top 20 token accounts + total supply in parallel
    const [largestData, supplyData] = await Promise.all([
      rpc(1, 'getTokenLargestAccounts', [ca, { commitment: 'confirmed' }]),
      rpc(2, 'getTokenSupply', [ca, { commitment: 'confirmed' }]),
    ]);

    const accounts   = largestData.result?.value?.slice(0, 10) || [];
    const totalSupply = parseFloat(supplyData.result?.value?.uiAmount) || 0;

    if (accounts.length === 0) {
      return res.status(200).json({ holders: [], totalSupply });
    }

    // Resolve token accounts → owner wallets
    const tokenAddresses = accounts.map(a => a.address);
    const infoData = await rpc(3, 'getMultipleAccounts', [
      tokenAddresses,
      { encoding: 'jsonParsed', commitment: 'confirmed' },
    ]);
    const infos = infoData.result?.value || [];

    const holders = accounts.map((acct, i) => {
      const owner  = infos[i]?.data?.parsed?.info?.owner || acct.address;
      const amount = parseFloat(acct.uiAmount) || 0;
      const pct    = totalSupply > 0 ? (amount / totalSupply) * 100 : 0;
      return { owner, tokenAccount: acct.address, amount, pct };
    });

    return res.status(200).json({ holders, totalSupply });
  } catch (e) {
    return res.status(502).json({ error: `Helius error: ${e.message}` });
  }
};
