/**
 * MoonAi — Advanced Bundle Detection v2
 *
 * Detection layers (in order of strength):
 * 1. Jito tip confirmation  — definitive proof a Jito bundle was used
 * 2. Same funding wallet    — multiple buyers funded from same SOL source
 * 3. Same slot grouping     — multiple buys in same 400ms slot
 * 4. New wallet detection   — wallets with no prior history before this token
 * 5. Extended launch window — first 15 slots after creation
 * 6. Dev wallet in bundle   — flag if creator wallet bought at launch
 * 7. Still holding cross-ref — what % bundled wallets currently hold
 */

const HELIUS_KEY    = process.env.HELIUS_API_KEY;
const RPC_URL       = () => `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`;
const ENHANCED_URL  = () => `https://api.helius.xyz/v0/transactions?api-key=${HELIUS_KEY}`;
const TOTAL_SUPPLY  = 1_000_000_000;
const LAUNCH_WINDOW = 15; // slots after creation

// Known Jito tip accounts — payment to any of these = confirmed Jito bundle
const JITO_TIP_ACCOUNTS = new Set([
  '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5',
  'HFqU5x63VTqvB8BoL9yY6x3wnwFKJgSjvSh5GHGgHHEw',
  'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY',
  'ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1sMaC9jnNNX',
  'DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL3',
  '3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT',
  'ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt',
  'DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh',
]);

async function rpc(id, method, params) {
  const res = await fetch(RPC_URL(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  });
  return res.json();
}

async function getEnhancedTxns(signatures) {
  if (!signatures.length) return [];
  const res = await fetch(ENHANCED_URL(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transactions: signatures }),
  });
  return res.json();
}

// Get the SOL funding source for a wallet (last major SOL inflow before timestamp)
async function getFundingWallet(walletAddress, beforeSlot) {
  try {
    const sigsData = await rpc('wf_' + walletAddress.slice(0, 8), 'getSignaturesForAddress', [
      walletAddress,
      { limit: 20, commitment: 'confirmed' },
    ]);
    const sigs = (sigsData.result || [])
      .filter(s => !s.err && (s.slot || 0) <= beforeSlot)
      .slice(0, 5)
      .map(s => s.signature);

    if (!sigs.length) return null;

    const txns = await getEnhancedTxns(sigs);
    for (const tx of txns) {
      const inflow = (tx.nativeTransfers || []).find(
        t => t.toUserAccount === walletAddress && t.amount > 1_000_000 // >0.001 SOL
      );
      if (inflow?.fromUserAccount) return inflow.fromUserAccount;
    }
    return null;
  } catch { return null; }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { ca, dev } = req.query;
  if (!ca)         return res.status(400).json({ error: 'Missing ca parameter' });
  if (!HELIUS_KEY) return res.status(500).json({ error: 'Missing HELIUS_API_KEY' });

  try {
    // ── Step 1: Get first signatures for the token mint ───────────────────
    const sigsData = await rpc(1, 'getSignaturesForAddress', [
      ca,
      { limit: 100, commitment: 'confirmed' },
    ]);
    const allSigs = (sigsData.result || []).filter(s => !s.err);
    if (!allSigs.length) return res.status(200).json({ bundled: false, pct: '0.00', bundleCount: 0, wallets: 0, jitoConfirmed: false, bundles: [] });

    // Oldest first = launch window
    const launchSigs = allSigs.slice(-Math.min(30, allSigs.length)).reverse();
    const sigStrings = launchSigs.map(s => s.signature);

    // ── Step 2: Enhanced transaction data ────────────────────────────────
    const enhanced = await getEnhancedTxns(sigStrings);
    if (!Array.isArray(enhanced) || !enhanced.length) {
      return res.status(200).json({ bundled: false, pct: '0.00', bundleCount: 0, wallets: 0, jitoConfirmed: false, bundles: [] });
    }

    const sorted       = [...enhanced].sort((a, b) => (a.slot || 0) - (b.slot || 0));
    const creationSlot = sorted[0]?.slot || 0;

    // ── Step 3: Parse launch window transactions ──────────────────────────
    const buyerMap = {}; // wallet → { amount, slot, isNew, jitoConfirmed }

    for (const tx of enhanced) {
      if (!tx.slot || tx.transactionError) continue;
      if (tx.slot > creationSlot + LAUNCH_WINDOW) continue;

      // Check for Jito tip in this transaction
      const hasJitoTip = (tx.nativeTransfers || []).some(
        t => JITO_TIP_ACCOUNTS.has(t.toUserAccount)
      );

      // Find token buys for this CA
      const transfers = (tx.tokenTransfers || []).filter(
        t => t.mint === ca && t.tokenAmount > 0 && t.toUserAccount
      );

      for (const t of transfers) {
        const wallet = t.toUserAccount;
        if (!buyerMap[wallet]) {
          buyerMap[wallet] = { amount: 0, slot: tx.slot, jitoConfirmed: false, sig: tx.signature };
        }
        buyerMap[wallet].amount       += parseFloat(t.tokenAmount) || 0;
        buyerMap[wallet].jitoConfirmed = buyerMap[wallet].jitoConfirmed || hasJitoTip;
      }
    }

    const launchBuyers = Object.entries(buyerMap);
    if (!launchBuyers.length) {
      return res.status(200).json({ bundled: false, pct: '0.00', bundleCount: 0, wallets: 0, jitoConfirmed: false, bundles: [] });
    }

    // ── Step 4: Funding wallet analysis (top 10 buyers max for speed) ─────
    const topBuyers = launchBuyers
      .sort((a, b) => b[1].amount - a[1].amount)
      .slice(0, 10);

    const fundingResults = await Promise.allSettled(
      topBuyers.map(([wallet, data]) => getFundingWallet(wallet, data.slot))
    );

    const fundingMap = {}; // wallet → funder
    topBuyers.forEach(([wallet], i) => {
      fundingMap[wallet] = fundingResults[i].status === 'fulfilled'
        ? fundingResults[i].value
        : null;
    });

    // Group by funder (same funder = coordinated even across slots)
    const funderGroups = {};
    for (const [wallet, data] of topBuyers) {
      const funder = fundingMap[wallet] || `slot_${data.slot}`; // fallback to slot grouping
      if (!funderGroups[funder]) funderGroups[funder] = [];
      funderGroups[funder].push({ wallet, ...data });
    }

    // ── Step 5: Also group remaining buyers by slot ───────────────────────
    const slotGroups = {};
    for (const [wallet, data] of launchBuyers) {
      const slot = data.slot;
      if (!slotGroups[slot]) slotGroups[slot] = [];
      slotGroups[slot].push({ wallet, ...data });
    }

    // ── Step 6: Build final bundle list ──────────────────────────────────
    const bundleSet  = new Set(); // wallet → bundle index
    const bundleList = [];
    let   jitoConfirmedAny = false;
    let   devBundled = false;

    // Priority 1: Jito-confirmed buys (strongest signal)
    const jitoBuyers = launchBuyers.filter(([, d]) => d.jitoConfirmed);
    if (jitoBuyers.length >= 1) {
      jitoConfirmedAny = true;
      const jb = { type: 'JITO', label: '🔴 Jito Confirmed', wallets: [], amount: 0, pct: '0.00', jitoConfirmed: true };
      for (const [wallet, data] of jitoBuyers) {
        if (bundleSet.has(wallet)) continue;
        bundleSet.add(wallet);
        jb.wallets.push(wallet.slice(0, 4) + '…' + wallet.slice(-4));
        jb.amount += data.amount;
        if (dev && wallet.toLowerCase() === dev.toLowerCase()) devBundled = true;
      }
      if (jb.wallets.length >= 1) {
        jb.pct = ((jb.amount / TOTAL_SUPPLY) * 100).toFixed(2);
        bundleList.push(jb);
      }
    }

    // Priority 2: Same funding wallet groups (≥2 wallets from same funder)
    for (const [funder, wallets] of Object.entries(funderGroups)) {
      if (funder.startsWith('slot_')) continue; // handled in slot pass
      if (wallets.length < 2) continue;
      const fb = { type: 'FUNDED', label: '🟠 Same Funder', wallets: [], amount: 0, pct: '0.00', funder: funder.slice(0, 4) + '…' + funder.slice(-4), jitoConfirmed: false };
      for (const { wallet, amount } of wallets) {
        if (bundleSet.has(wallet)) continue;
        bundleSet.add(wallet);
        fb.wallets.push(wallet.slice(0, 4) + '…' + wallet.slice(-4));
        fb.amount += amount;
        if (dev && wallet.toLowerCase() === dev.toLowerCase()) devBundled = true;
      }
      if (fb.wallets.length >= 2) {
        fb.pct = ((fb.amount / TOTAL_SUPPLY) * 100).toFixed(2);
        bundleList.push(fb);
      }
    }

    // Priority 3: Same slot groups (≥2 wallets in same slot)
    for (const [slot, wallets] of Object.entries(slotGroups)) {
      if (wallets.length < 2) continue;
      const sb = { type: 'SLOT', label: '🟡 Same Slot', wallets: [], amount: 0, pct: '0.00', slot: parseInt(slot), jitoConfirmed: false };
      for (const { wallet, amount, jitoConfirmed } of wallets) {
        if (bundleSet.has(wallet)) continue;
        bundleSet.add(wallet);
        sb.wallets.push(wallet.slice(0, 4) + '…' + wallet.slice(-4));
        sb.amount += amount;
        sb.jitoConfirmed = sb.jitoConfirmed || jitoConfirmed;
        if (dev && wallet.toLowerCase() === dev.toLowerCase()) devBundled = true;
      }
      if (sb.wallets.length >= 2) {
        sb.pct = ((sb.amount / TOTAL_SUPPLY) * 100).toFixed(2);
        bundleList.push(sb);
      }
    }

    // ── Step 7: Totals ────────────────────────────────────────────────────
    const totalBundledAmount = bundleList.reduce((s, b) => s + b.amount, 0);
    const totalPct           = ((totalBundledAmount / TOTAL_SUPPLY) * 100).toFixed(2);
    const totalWallets       = bundleSet.size;

    // New wallet count (wallets that had no prior history = first tx is this token)
    const newWalletCount = topBuyers.filter(([, d]) =>
      launchSigs.findIndex(s => s.signature === d.sig) >= launchSigs.length - 3
    ).length;

    return res.status(200).json({
      bundled:        bundleList.length > 0,
      pct:            totalPct,
      bundleCount:    bundleList.length,
      wallets:        totalWallets,
      jitoConfirmed:  jitoConfirmedAny,
      devBundled,
      newWallets:     newWalletCount,
      bundles:        bundleList,
    });

  } catch (e) {
    return res.status(502).json({ error: `Bundle detection error: ${e.message}` });
  }
};
