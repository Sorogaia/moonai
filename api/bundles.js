const { isValidCA, getIP } = require('./_validate');
const { checkRateLimit }   = require('./_ratelimit');

const HELIUS_KEY    = process.env.HELIUS_API_KEY;
const RPC_URL       = () => `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`;
const ENHANCED_URL  = () => `https://api.helius.xyz/v0/transactions?api-key=${HELIUS_KEY}`;
const TOTAL_SUPPLY  = 1_000_000_000;
const LAUNCH_WINDOW = 15;

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

  const ip      = getIP(req);
  const allowed = await checkRateLimit(ip, { limit: 30, window: 60, prefix: 'bundles' }).catch(() => true);
  if (!allowed) return res.status(429).json({ error: 'Rate limit exceeded.' });

  const { ca, dev } = req.query;
  if (!ca || !isValidCA(ca))     return res.status(400).json({ error: 'Invalid token address.' });
  if (dev && !isValidCA(dev))    return res.status(400).json({ error: 'Invalid dev address.' });
  if (!HELIUS_KEY)               return res.status(500).json({ error: 'Service unavailable.' });

  try {
        const sigsData = await rpc(1, 'getSignaturesForAddress', [
      ca,
      { limit: 100, commitment: 'confirmed' },
    ]);
    const allSigs = (sigsData.result || []).filter(s => !s.err);
    if (!allSigs.length) return res.status(200).json({ bundled: false, pct: '0.00', bundleCount: 0, wallets: 0, jitoConfirmed: false, bundles: [] });

        const launchSigs = allSigs.slice(-Math.min(30, allSigs.length)).reverse();
    const sigStrings = launchSigs.map(s => s.signature);

        const enhanced = await getEnhancedTxns(sigStrings);
    if (!Array.isArray(enhanced) || !enhanced.length) {
      return res.status(200).json({ bundled: false, pct: '0.00', bundleCount: 0, wallets: 0, jitoConfirmed: false, bundles: [] });
    }

    const sorted       = [...enhanced].sort((a, b) => (a.slot || 0) - (b.slot || 0));
    const creationSlot = sorted[0]?.slot || 0;

        const buyerMap = {}; 
    for (const tx of enhanced) {
      if (!tx.slot || tx.transactionError) continue;
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

        const topBuyers = launchBuyers
      .sort((a, b) => b[1].amount - a[1].amount)
      .slice(0, 10);

    const fundingResults = await Promise.allSettled(
      topBuyers.map(([wallet, data]) => getFundingWallet(wallet, data.slot))
    );

    const fundingMap = {};     topBuyers.forEach(([wallet], i) => {
      fundingMap[wallet] = fundingResults[i].status === 'fulfilled'
        ? fundingResults[i].value
        : null;
    });

        const funderGroups = {};
    for (const [wallet, data] of topBuyers) {
      const funder = fundingMap[wallet] || `slot_${data.slot}`; // fallback to slot grouping
      if (!funderGroups[funder]) funderGroups[funder] = [];
      funderGroups[funder].push({ wallet, ...data });
    }

        const slotGroups = {};
    for (const [wallet, data] of launchBuyers) {
      const slot = data.slot;
      if (!slotGroups[slot]) slotGroups[slot] = [];
      slotGroups[slot].push({ wallet, ...data });
    }

        const bundleSet  = new Set();     const bundleList = [];
    let   jitoConfirmedAny = false;
    let   devBundled = false;

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

        const totalBundledAmount = bundleList.reduce((s, b) => s + b.amount, 0);
    const totalPct           = ((totalBundledAmount / TOTAL_SUPPLY) * 100).toFixed(2);
    const totalWallets       = bundleSet.size;

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
    return res.status(502).json({ error: 'Bundle detection unavailable.' });
  }
};
