/**
 * MoonAi — Bundle Detection
 * Detects coordinated launch buys (Jito bundles) by grouping
 * first transactions on a token mint by slot number.
 * Same slot = same bundle.
 */

const HELIUS_KEY     = process.env.HELIUS_API_KEY;
const RPC_URL        = () => `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`;
const ENHANCED_URL   = () => `https://api.helius.xyz/v0/transactions?api-key=${HELIUS_KEY}`;
const TOTAL_SUPPLY   = 1_000_000_000;
const LAUNCH_WINDOW  = 5; // slots after creation = launch window

async function rpc(id, method, params) {
  const res = await fetch(RPC_URL(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  });
  return res.json();
}

async function getEnhancedTxns(signatures) {
  const res = await fetch(ENHANCED_URL(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transactions: signatures }),
  });
  return res.json();
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { ca } = req.query;
  if (!ca)         return res.status(400).json({ error: 'Missing ca parameter' });
  if (!HELIUS_KEY) return res.status(500).json({ error: 'Missing HELIUS_API_KEY' });

  try {
    // ── Step 1: Get up to 100 signatures for the token mint ──────────────
    const sigsData = await rpc(1, 'getSignaturesForAddress', [
      ca,
      { limit: 100, commitment: 'confirmed' },
    ]);

    const allSigs = (sigsData.result || []).filter(s => !s.err);
    if (allSigs.length === 0) {
      return res.status(200).json({ bundled: false, pct: '0.00', bundleCount: 0, wallets: 0, bundles: [] });
    }

    // Signatures come back newest→oldest. Reverse to get oldest first (launch txns).
    const launchSigs = allSigs.slice(-Math.min(25, allSigs.length)).reverse();
    const sigStrings = launchSigs.map(s => s.signature);

    // ── Step 2: Fetch enhanced parsed transactions ────────────────────────
    const enhanced = await getEnhancedTxns(sigStrings);
    if (!Array.isArray(enhanced) || enhanced.length === 0) {
      return res.status(200).json({ bundled: false, pct: '0.00', bundleCount: 0, wallets: 0, bundles: [] });
    }

    // ── Step 3: Find creation slot (first tx = mint creation) ────────────
    const sortedBySlot = [...enhanced].sort((a, b) => (a.slot || 0) - (b.slot || 0));
    const creationSlot = sortedBySlot[0]?.slot || 0;

    // ── Step 4: Group token transfers by slot ────────────────────────────
    const slotMap = {};
    for (const tx of enhanced) {
      if (!tx.slot || tx.transactionError) continue;
      const slot = tx.slot;

      // Only analyse transactions in the launch window
      if (slot > creationSlot + LAUNCH_WINDOW) continue;

      const transfers = (tx.tokenTransfers || []).filter(
        t => t.mint === ca && t.tokenAmount > 0 && t.toUserAccount
      );

      for (const t of transfers) {
        if (!slotMap[slot]) slotMap[slot] = [];
        slotMap[slot].push({
          wallet:    t.toUserAccount,
          amount:    parseFloat(t.tokenAmount) || 0,
          signature: tx.signature,
        });
      }
    }

    // ── Step 5: Identify bundles (≥2 buys in same slot) ──────────────────
    let totalBundledAmount = 0;
    const bundleList = [];

    for (const [slot, buys] of Object.entries(slotMap)) {
      // Deduplicate wallets in same slot
      const walletMap = {};
      for (const b of buys) {
        walletMap[b.wallet] = (walletMap[b.wallet] || 0) + b.amount;
      }
      const uniqueWallets = Object.entries(walletMap);

      // A bundle requires ≥2 distinct wallets in the same slot
      if (uniqueWallets.length < 2) continue;

      const slotAmount = uniqueWallets.reduce((s, [, a]) => s + a, 0);
      totalBundledAmount += slotAmount;

      bundleList.push({
        slot:    parseInt(slot),
        wallets: uniqueWallets.map(([w]) => w.slice(0, 4) + '…' + w.slice(-4)),
        amount:  slotAmount,
        pct:     ((slotAmount / TOTAL_SUPPLY) * 100).toFixed(2),
      });
    }

    const allBundledWallets = [...new Set(
      bundleList.flatMap(b =>
        (slotMap[b.slot] || []).map(x => x.wallet)
      )
    )];

    const totalPct = ((totalBundledAmount / TOTAL_SUPPLY) * 100).toFixed(2);

    return res.status(200).json({
      bundled:     bundleList.length > 0,
      pct:         totalPct,
      bundleCount: bundleList.length,
      wallets:     allBundledWallets.length,
      bundles:     bundleList,
    });

  } catch (e) {
    return res.status(502).json({ error: `Bundle detection error: ${e.message}` });
  }
};
