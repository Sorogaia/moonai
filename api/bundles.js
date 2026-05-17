const { isValidCA, getIP } = require('./_validate');
const { checkRateLimit }   = require('./_ratelimit');

const HELIUS_KEY    = process.env.HELIUS_API_KEY;
const RPC_URL       = () => `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`;
const ENHANCED_URL  = () => `https://api.helius.xyz/v0/transactions?api-key=${HELIUS_KEY}`;

// ~2 minutes of slots at ~400ms/slot — catches coordinated multi-wave buys
const LAUNCH_WINDOW = 300;
// Max pages of 1000 signatures to paginate back to launch
const MAX_SIG_PAGES = 4;
// How many launch txns to deep-scan (Helius enhanced API max per call = 100)
const LAUNCH_TXNS   = 100;
// How many top buyers to trace funding wallet for
const FUND_DEPTH    = 20;

// All known Jito tip accounts (updated 2026)
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
  // Helius enhanced API: max 100 per call
  const batch = signatures.slice(0, 100);
  const res = await fetch(ENHANCED_URL(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transactions: batch }),
  });
  return res.json();
}

/**
 * Paginate getSignaturesForAddress backwards until we reach the very first
 * transactions for this mint. Returns signatures in DESCENDING order (newest first).
 * We'll reverse at the end to get chronological order.
 */
async function getAllLaunchSignatures(ca) {
  const all = [];
  let cursor = undefined;

  for (let page = 0; page < MAX_SIG_PAGES; page++) {
    const params = [ca, { limit: 1000, commitment: 'confirmed' }];
    if (cursor) params[1].before = cursor;

    const data = await rpc(`sigs_p${page}`, 'getSignaturesForAddress', params);
    const sigs = (data.result || []).filter(s => !s.err);

    if (!sigs.length) break;
    all.push(...sigs);

    // Fewer than 1000 means we've reached the very beginning — stop paginating
    if (sigs.length < 1000) break;

    // Set cursor to oldest sig in this page so next page goes further back
    cursor = sigs[sigs.length - 1].signature;
  }

  return all; // newest-first order
}

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
        t => t.toUserAccount === walletAddress && t.amount > 1_000_000
      );
      if (inflow?.fromUserAccount) return inflow.fromUserAccount;
    }
    return null;
  } catch { return null; }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const ip      = getIP(req);
  const allowed = await checkRateLimit(ip, { limit: 30, window: 60, prefix: 'bundles' }).catch(() => false);
  if (!allowed) return res.status(429).json({ error: 'Rate limit exceeded.' });

  const { ca, dev } = req.query;
  if (!ca || !isValidCA(ca))  return res.status(400).json({ error: 'Invalid token address.' });
  if (dev && !isValidCA(dev)) return res.status(400).json({ error: 'Invalid dev address.' });
  if (!HELIUS_KEY)             return res.status(500).json({ error: 'Service unavailable.' });

  try {
    // ── Step 1: Get actual token supply + paginate back to launch signatures ──
    const [supplyData, allSigsNewestFirst] = await Promise.all([
      rpc('supply', 'getTokenSupply', [ca, { commitment: 'confirmed' }]),
      getAllLaunchSignatures(ca),
    ]);

    if (!allSigsNewestFirst.length) {
      return res.status(200).json({ bundled: false, pct: '0.00', bundleCount: 0, wallets: 0, jitoConfirmed: false, bundles: [] });
    }

    // Real on-chain supply — fall back to 1B for pump.fun tokens
    const totalSupply = parseFloat(supplyData?.result?.value?.uiAmount || 0) || 1_000_000_000;

    // Chronological order: oldest first (launch transactions are at the END of newest-first list)
    // Take the oldest LAUNCH_TXNS transactions — these are the actual launch buys
    const launchSigsChron = allSigsNewestFirst
      .slice(-Math.min(LAUNCH_TXNS, allSigsNewestFirst.length))
      .reverse(); // now oldest first

    const sigStrings = launchSigsChron.map(s => s.signature);

    // ── Step 2: Get enhanced transaction data for launch window ──
    const enhanced = await getEnhancedTxns(sigStrings);
    if (!Array.isArray(enhanced) || !enhanced.length) {
      return res.status(200).json({ bundled: false, pct: '0.00', bundleCount: 0, wallets: 0, jitoConfirmed: false, bundles: [] });
    }

    // The actual creation slot is the minimum slot across ALL fetched signatures
    // (we paginated to the beginning, so allSigsNewestFirst.at(-1) is the oldest)
    const oldestSig = allSigsNewestFirst[allSigsNewestFirst.length - 1];
    const creationSlot = oldestSig?.slot || enhanced.reduce((min, tx) => Math.min(min, tx.slot || Infinity), Infinity);

    // ── Step 3: Map buyers in the launch window ──
    const buyerMap = {};

    for (const tx of enhanced) {
      if (!tx.slot || tx.transactionError) continue;

      // Wider launch window — ~2 minutes from creation
      if (tx.slot > creationSlot + LAUNCH_WINDOW) continue;

      const hasJitoTip = (tx.nativeTransfers || []).some(
        t => JITO_TIP_ACCOUNTS.has(t.toUserAccount)
      );

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

    // ── Step 4: Trace funding wallets for top buyers ──
    const topBuyers = launchBuyers
      .sort((a, b) => b[1].amount - a[1].amount)
      .slice(0, FUND_DEPTH); // check top 20, not just 10

    const fundingResults = await Promise.allSettled(
      topBuyers.map(([wallet, data]) => getFundingWallet(wallet, data.slot))
    );

    const fundingMap = {};
    topBuyers.forEach(([wallet], i) => {
      fundingMap[wallet] = fundingResults[i].status === 'fulfilled'
        ? fundingResults[i].value
        : null;
    });

    // ── Step 5: Group into bundle types ──

    // Same funding wallet groups
    const funderGroups = {};
    for (const [wallet, data] of topBuyers) {
      const funder = fundingMap[wallet] || `solo_${wallet}`;
      if (!funderGroups[funder]) funderGroups[funder] = [];
      funderGroups[funder].push({ wallet, ...data });
    }

    // Same-slot groups (across all launch buyers, not just top)
    // Also bucket adjacent slots (±1) to catch split bundles
    const slotBuckets = {};
    for (const [wallet, data] of launchBuyers) {
      const bucket = Math.floor(data.slot / 2); // group every 2 slots (~800ms)
      if (!slotBuckets[bucket]) slotBuckets[bucket] = [];
      slotBuckets[bucket].push({ wallet, ...data });
    }

    const bundleSet  = new Set();
    const bundleList = [];
    let jitoConfirmedAny = false;
    let devBundled = false;

    // Jito bundles — highest confidence
    const jitoBuyers = launchBuyers.filter(([, d]) => d.jitoConfirmed);
    if (jitoBuyers.length >= 1) {
      jitoConfirmedAny = true;
      const jb = { type: 'JITO', label: '🔴 Jito Bundle', wallets: [], amount: 0, pct: '0.00', jitoConfirmed: true };
      for (const [wallet, data] of jitoBuyers) {
        if (bundleSet.has(wallet)) continue;
        bundleSet.add(wallet);
        jb.wallets.push(wallet.slice(0, 4) + '…' + wallet.slice(-4));
        jb.amount += data.amount;
        if (dev && wallet.toLowerCase() === dev.toLowerCase()) devBundled = true;
      }
      if (jb.wallets.length >= 1) {
        jb.pct = ((jb.amount / totalSupply) * 100).toFixed(2);
        bundleList.push(jb);
      }
    }

    // Same-funder bundles
    for (const [funder, wallets] of Object.entries(funderGroups)) {
      if (funder.startsWith('solo_')) continue;
      if (wallets.length < 2) continue;
      const fb = {
        type: 'FUNDED', label: '🟠 Same Funder',
        wallets: [], amount: 0, pct: '0.00',
        funder: funder.slice(0, 4) + '…' + funder.slice(-4), jitoConfirmed: false,
      };
      for (const { wallet, amount } of wallets) {
        if (bundleSet.has(wallet)) continue;
        bundleSet.add(wallet);
        fb.wallets.push(wallet.slice(0, 4) + '…' + wallet.slice(-4));
        fb.amount += amount;
        if (dev && wallet.toLowerCase() === dev.toLowerCase()) devBundled = true;
      }
      if (fb.wallets.length >= 2) {
        fb.pct = ((fb.amount / totalSupply) * 100).toFixed(2);
        bundleList.push(fb);
      }
    }

    // Same-slot / adjacent-slot bundles
    for (const [bucket, wallets] of Object.entries(slotBuckets)) {
      if (wallets.length < 2) continue;
      const sb = {
        type: 'SLOT', label: '🟡 Same Slot',
        wallets: [], amount: 0, pct: '0.00',
        slot: wallets[0].slot, jitoConfirmed: false,
      };
      for (const { wallet, amount, jitoConfirmed } of wallets) {
        if (bundleSet.has(wallet)) continue;
        bundleSet.add(wallet);
        sb.wallets.push(wallet.slice(0, 4) + '…' + wallet.slice(-4));
        sb.amount += amount;
        sb.jitoConfirmed = sb.jitoConfirmed || jitoConfirmed;
        if (dev && wallet.toLowerCase() === dev.toLowerCase()) devBundled = true;
      }
      if (sb.wallets.length >= 2) {
        sb.pct = ((sb.amount / totalSupply) * 100).toFixed(2);
        bundleList.push(sb);
      }
    }

    const totalBundledAmount = bundleList.reduce((s, b) => s + b.amount, 0);
    const totalPct           = ((totalBundledAmount / totalSupply) * 100).toFixed(2);
    const totalWallets       = bundleSet.size;

    return res.status(200).json({
      bundled:       bundleList.length > 0,
      pct:           totalPct,
      bundleCount:   bundleList.length,
      wallets:       totalWallets,
      jitoConfirmed: jitoConfirmedAny,
      devBundled,
      bundles:       bundleList,
      // Debug metadata (can remove in prod)
      _meta: {
        totalSigsScanned: allSigsNewestFirst.length,
        launchTxnsAnalyzed: enhanced.length,
        creationSlot,
        launchWindowSlots: LAUNCH_WINDOW,
        totalSupply,
      },
    });

  } catch (e) {
    return res.status(502).json({ error: 'Bundle detection unavailable.' });
  }
};
