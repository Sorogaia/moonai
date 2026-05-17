const { isValidCA, getIP } = require('./_validate');
const { checkRateLimit }   = require('./_ratelimit');

const HELIUS_KEY   = process.env.HELIUS_API_KEY;
const RPC_URL      = () => `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`;
const ENHANCED_URL = () => `https://api.helius.xyz/v0/transactions?api-key=${HELIUS_KEY}`;

const LAUNCH_WINDOW = 300;   // ~2 min in slots
const MAX_SIG_PAGES = 4;     // up to 4000 signatures paginated
const LAUNCH_TXNS   = 100;   // enhanced API max per call
const FUND_DEPTH    = 20;    // trace funding for top N buyers

// All known Jito tip accounts
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

// Known system / program addresses to exclude from buyer detection
const EXCLUDED_ACCOUNTS = new Set([
  '11111111111111111111111111111111',          // System program
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', // Token program
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe8bXt', // Associated token program
  'ComputeBudget111111111111111111111111111111',
  'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s',  // Metaplex
  '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',  // pump.fun program
  'Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1', // pump.fun fee
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
    body: JSON.stringify({ transactions: signatures.slice(0, 100) }),
  });
  return res.json();
}

/** Paginate back to the very first transaction for this mint */
async function getAllLaunchSignatures(ca) {
  const all = [];
  let cursor;
  for (let page = 0; page < MAX_SIG_PAGES; page++) {
    const params = [ca, { limit: 1000, commitment: 'confirmed' }];
    if (cursor) params[1].before = cursor;
    const data = await rpc(`sigs_p${page}`, 'getSignaturesForAddress', params);
    const sigs = (data.result || []).filter(s => !s.err);
    if (!sigs.length) break;
    all.push(...sigs);
    if (sigs.length < 1000) break; // reached the beginning
    cursor = sigs[sigs.length - 1].signature;
  }
  return all; // newest-first order
}

async function getFundingWallet(walletAddress, beforeSlot) {
  try {
    const sigsData = await rpc('wf_' + walletAddress.slice(0, 8), 'getSignaturesForAddress', [
      walletAddress, { limit: 20, commitment: 'confirmed' },
    ]);
    const sigs = (sigsData.result || [])
      .filter(s => !s.err && (s.slot || 0) <= beforeSlot)
      .slice(0, 5).map(s => s.signature);
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
    // ── Step 1: Supply + paginate to launch ───────────────────────────────
    const [supplyData, allSigsNewestFirst] = await Promise.all([
      rpc('supply', 'getTokenSupply', [ca, { commitment: 'confirmed' }]),
      getAllLaunchSignatures(ca),
    ]);

    if (!allSigsNewestFirst.length) {
      return res.status(200).json({ bundled: false, pct: '0.00', bundleCount: 0, wallets: 0, jitoConfirmed: false, bundles: [] });
    }

    const totalSupply = parseFloat(supplyData?.result?.value?.uiAmount || 0) || 1_000_000_000;

    // Take the 100 oldest signatures = the actual launch transactions
    const launchSigsChron = allSigsNewestFirst
      .slice(-Math.min(LAUNCH_TXNS, allSigsNewestFirst.length))
      .reverse();

    // ── Step 2: Get enhanced data for launch window ───────────────────────
    const enhanced = await getEnhancedTxns(launchSigsChron.map(s => s.signature));
    if (!Array.isArray(enhanced) || !enhanced.length) {
      return res.status(200).json({ bundled: false, pct: '0.00', bundleCount: 0, wallets: 0, jitoConfirmed: false, bundles: [] });
    }

    // Creation slot from the oldest signature in full history
    const creationSlot = allSigsNewestFirst[allSigsNewestFirst.length - 1]?.slot
      || Math.min(...enhanced.map(tx => tx.slot || Infinity));

    // ── Step 3: Identify bonding curve via most-common SOL recipient ──────
    // Helius often parses pump.fun buys as SWAP type, so tokenTransfers can
    // be missing or incorrect. We use nativeTransfers as ground truth for
    // who actually sent SOL (= who bought).
    const solRecipientCount = {};
    for (const tx of enhanced) {
      if (tx.transactionError) continue;
      for (const nt of (tx.nativeTransfers || [])) {
        if (!nt.fromUserAccount || !nt.toUserAccount) continue;
        if (JITO_TIP_ACCOUNTS.has(nt.toUserAccount))   continue;
        if (EXCLUDED_ACCOUNTS.has(nt.toUserAccount))    continue;
        if (nt.amount < 100_000) continue; // <0.0001 SOL = ignore dust
        solRecipientCount[nt.toUserAccount] = (solRecipientCount[nt.toUserAccount] || 0) + 1;
      }
    }

    // Bonding curve = address that received SOL most frequently
    const bondingCurve = Object.entries(solRecipientCount)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || null;

    // ── Step 4: Build buyer map — HYBRID (tokenTransfers + nativeTransfers) ─
    const buyerMap = {};

    const addBuyer = (wallet, amount, slot, sig, hasJito) => {
      if (!wallet || EXCLUDED_ACCOUNTS.has(wallet) || JITO_TIP_ACCOUNTS.has(wallet)) return;
      if (!buyerMap[wallet]) {
        buyerMap[wallet] = { amount: 0, slot, sig, jitoConfirmed: false };
      }
      if (amount > 0) buyerMap[wallet].amount += amount;
      buyerMap[wallet].jitoConfirmed = buyerMap[wallet].jitoConfirmed || hasJito;
    };

    for (const tx of enhanced) {
      if (!tx.slot || tx.transactionError) continue;
      if (tx.slot > creationSlot + LAUNCH_WINDOW) continue;

      const hasJito = (tx.nativeTransfers || []).some(t => JITO_TIP_ACCOUNTS.has(t.toUserAccount));

      // Method A — tokenTransfers (standard; works when Helius parses the token program)
      for (const t of (tx.tokenTransfers || [])) {
        if (t.mint !== ca || !(t.tokenAmount > 0) || !t.toUserAccount) continue;
        addBuyer(t.toUserAccount, parseFloat(t.tokenAmount) || 0, tx.slot, tx.signature, hasJito);
      }

      // Method B — nativeTransfers to bonding curve (pump.fun swap fallback)
      // Even if tokenTransfers is empty/wrong, we can detect the buyer by SOL flow
      if (bondingCurve) {
        for (const nt of (tx.nativeTransfers || [])) {
          if (nt.toUserAccount !== bondingCurve) continue;
          if (!nt.fromUserAccount || nt.amount < 100_000) continue;
          if (EXCLUDED_ACCOUNTS.has(nt.fromUserAccount)) continue;
          // Only add if not already detected via tokenTransfers (avoid double-count)
          // If detected both ways, tokenTransfers amount wins; this just registers the wallet
          addBuyer(nt.fromUserAccount, buyerMap[nt.fromUserAccount]?.amount || 0, tx.slot, tx.signature, hasJito);
        }
      }
    }

    // ── Step 5: Fill missing token amounts from current on-chain balance ────
    // Wallets detected via nativeTransfers have amount=0 because Helius's
    // tokenTransfers was empty for their pump.fun buy transaction.
    // For new tokens, current balance ≈ launch buy amount (they haven't sold).
    // Use getTokenAccountsByOwner to get actual current holdings.
    const walletsWithoutAmount = Object.entries(buyerMap).filter(([, d]) => d.amount === 0);
    if (walletsWithoutAmount.length > 0) {
      const balResults = await Promise.allSettled(
        walletsWithoutAmount.map(([wallet]) =>
          rpc('bal_' + wallet.slice(0, 8), 'getTokenAccountsByOwner', [
            wallet,
            { mint: ca },
            { encoding: 'jsonParsed', commitment: 'confirmed' },
          ])
        )
      );
      walletsWithoutAmount.forEach(([wallet, data], i) => {
        const r = balResults[i];
        if (r.status !== 'fulfilled') return;
        const accts = r.value?.result?.value || [];
        for (const acct of accts) {
          const bal = parseFloat(acct.account?.data?.parsed?.info?.tokenAmount?.uiAmount || 0);
          if (bal > 0) data.amount += bal;
        }
      });
    }

    const launchBuyers = Object.entries(buyerMap);
    if (!launchBuyers.length) {
      return res.status(200).json({
        bundled: false, pct: '0.00', bundleCount: 0, wallets: 0, jitoConfirmed: false, bundles: [],
        _meta: { totalSigsScanned: allSigsNewestFirst.length, launchTxnsAnalyzed: enhanced.length, creationSlot, buyersFound: 0, bondingCurve },
      });
    }

    // ── Step 6: Trace funding wallets ─────────────────────────────────────
    const topBuyers = launchBuyers.sort((a, b) => b[1].amount - a[1].amount).slice(0, FUND_DEPTH);

    const fundingResults = await Promise.allSettled(
      topBuyers.map(([wallet, data]) => getFundingWallet(wallet, data.slot))
    );
    const fundingMap = {};
    topBuyers.forEach(([wallet], i) => {
      fundingMap[wallet] = fundingResults[i].status === 'fulfilled' ? fundingResults[i].value : null;
    });

    // ── Step 7: Build bundle groups ───────────────────────────────────────
    // Same-funder groups
    const funderGroups = {};
    for (const [wallet, data] of topBuyers) {
      const funder = fundingMap[wallet] || `solo_${wallet}`;
      if (!funderGroups[funder]) funderGroups[funder] = [];
      funderGroups[funder].push({ wallet, ...data });
    }

    // 2-slot bucket groups (catches adjacent-slot bundles)
    const slotBuckets = {};
    for (const [wallet, data] of launchBuyers) {
      const bucket = Math.floor(data.slot / 2);
      if (!slotBuckets[bucket]) slotBuckets[bucket] = [];
      slotBuckets[bucket].push({ wallet, ...data });
    }

    const bundleSet  = new Set();
    const bundleList = [];
    let jitoConfirmedAny = false;
    let devBundled = false;

    // Jito bundles
    const jitoBuyers = launchBuyers.filter(([, d]) => d.jitoConfirmed);
    if (jitoBuyers.length >= 1) {
      jitoConfirmedAny = true;
      const jb = { type: 'JITO', label: '🔴 Jito Bundle', desc: 'Atomic bundle — all wallets bought in a single Jito transaction', wallets: [], fullWallets: [], amount: 0, pct: '0.00', jitoConfirmed: true };
      for (const [wallet, data] of jitoBuyers) {
        if (bundleSet.has(wallet)) continue;
        bundleSet.add(wallet);
        jb.wallets.push(wallet.slice(0, 4) + '…' + wallet.slice(-4));
        jb.fullWallets.push(wallet);
        jb.amount += data.amount;
        if (dev && wallet.toLowerCase() === dev.toLowerCase()) devBundled = true;
      }
      if (jb.wallets.length >= 1) { jb.pct = ((jb.amount / totalSupply) * 100).toFixed(2); bundleList.push(jb); }
    }

    // Same-funder bundles
    for (const [funder, wallets] of Object.entries(funderGroups)) {
      if (funder.startsWith('solo_') || wallets.length < 2) continue;
      const fb = { type: 'FUNDED', label: '🟠 Funded Together', desc: 'Multiple wallets pre-funded from the same source wallet', wallets: [], fullWallets: [], amount: 0, pct: '0.00', funder: funder.slice(0, 4) + '…' + funder.slice(-4), jitoConfirmed: false };
      for (const { wallet, amount } of wallets) {
        if (bundleSet.has(wallet)) continue;
        bundleSet.add(wallet);
        fb.wallets.push(wallet.slice(0, 4) + '…' + wallet.slice(-4));
        fb.fullWallets.push(wallet);
        fb.amount += amount;
        if (dev && wallet.toLowerCase() === dev.toLowerCase()) devBundled = true;
      }
      if (fb.wallets.length >= 2) { fb.pct = ((fb.amount / totalSupply) * 100).toFixed(2); bundleList.push(fb); }
    }

    // Same-slot / adjacent-slot bundles
    for (const [, wallets] of Object.entries(slotBuckets)) {
      if (wallets.length < 2) continue;
      const sb = { type: 'SLOT', label: '🟡 Block Snipers', desc: 'Multiple wallets bought in the same block — coordinated bots', wallets: [], fullWallets: [], amount: 0, pct: '0.00', slot: wallets[0].slot, jitoConfirmed: false };
      for (const { wallet, amount, jitoConfirmed } of wallets) {
        if (bundleSet.has(wallet)) continue;
        bundleSet.add(wallet);
        sb.wallets.push(wallet.slice(0, 4) + '…' + wallet.slice(-4));
        sb.fullWallets.push(wallet);
        sb.amount += amount;
        sb.jitoConfirmed = sb.jitoConfirmed || jitoConfirmed;
        if (dev && wallet.toLowerCase() === dev.toLowerCase()) devBundled = true;
      }
      if (sb.wallets.length >= 2) { sb.pct = ((sb.amount / totalSupply) * 100).toFixed(2); bundleList.push(sb); }
    }

    const totalBundledAmount = bundleList.reduce((s, b) => s + b.amount, 0);
    const totalPct  = ((totalBundledAmount / totalSupply) * 100).toFixed(2);

    // ── Step 8: Still-holding — fetch current on-chain balances for all bundled wallets ──
    // This tells us: of the tokens bundled at launch, how many are STILL held vs dumped.
    const bundleWallets = [...bundleSet];
    let currentHoldingTotal = 0;
    const currentBalMap = {};

    if (bundleWallets.length > 0) {
      const cbResults = await Promise.allSettled(
        bundleWallets.map(wallet =>
          rpc('cb_' + wallet.slice(0, 8), 'getTokenAccountsByOwner', [
            wallet,
            { mint: ca },
            { encoding: 'jsonParsed', commitment: 'confirmed' },
          ])
        )
      );
      bundleWallets.forEach((wallet, i) => {
        const r = cbResults[i];
        if (r.status !== 'fulfilled') return;
        const accts = r.value?.result?.value || [];
        const bal = accts.reduce(
          (s, a) => s + parseFloat(a.account?.data?.parsed?.info?.tokenAmount?.uiAmount || 0), 0
        );
        currentBalMap[wallet] = bal;
        currentHoldingTotal += bal;
      });
    }

    // Overall still-holding metrics
    const stillHoldingPct = totalBundledAmount > 0
      ? parseFloat(((currentHoldingTotal / totalBundledAmount) * 100).toFixed(1))
      : 0;
    const dumpedPct = parseFloat((100 - stillHoldingPct).toFixed(1));
    const stillHoldingSupplyPct = totalSupply > 0
      ? parseFloat(((currentHoldingTotal / totalSupply) * 100).toFixed(2))
      : 0;

    // Per-bundle still-holding + clean up fullWallets before response
    for (const bundle of bundleList) {
      const bundleCurrentBal = (bundle.fullWallets || [])
        .reduce((s, w) => s + (currentBalMap[w] || 0), 0);
      bundle.stillHoldingPct = bundle.amount > 0
        ? parseFloat(((bundleCurrentBal / bundle.amount) * 100).toFixed(1))
        : 0;
      bundle.dumpedPct = parseFloat((100 - bundle.stillHoldingPct).toFixed(1));
      bundle.currentAmount = parseFloat(bundleCurrentBal.toFixed(0));
      delete bundle.fullWallets; // internal only — not sent to client
    }

    return res.status(200).json({
      bundled:              bundleList.length > 0,
      pct:                  totalPct,
      bundleCount:          bundleList.length,
      wallets:              bundleSet.size,
      jitoConfirmed:        jitoConfirmedAny,
      devBundled,
      stillHoldingPct,
      dumpedPct,
      stillHoldingSupplyPct,
      bundles:              bundleList,
      _meta: {
        totalSigsScanned:    allSigsNewestFirst.length,
        launchTxnsAnalyzed:  enhanced.length,
        buyersFound:         launchBuyers.length,
        creationSlot,
        launchWindowSlots:   LAUNCH_WINDOW,
        bondingCurve,
        totalSupply,
        detectionMethod:     Object.values(buyerMap).some(b => b.amount > 0) ? 'hybrid' : 'native-only',
      },
    });

  } catch (e) {
    return res.status(502).json({ error: 'Bundle detection unavailable.' });
  }
};
