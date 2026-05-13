# API Reference

MoonAi uses a combination of free public APIs and secured backend proxies.

---

## Backend Endpoints (Vercel — keys never in browser)

### POST /api/chat
Proxies Claude AI server-side. Rate limited via Upstash Redis (20 req/min per IP).

**Request body:** Anthropic messages format
**Response:** Anthropic API response (passthrough)

---

### GET /api/holders?ca={CA}
Returns top 10 token holders with wallet addresses, amounts and % of supply.

**Response:**
```json
{
  "holders": [
    { "owner": "wallet...", "amount": 1234567, "pct": 1.23 }
  ],
  "totalSupply": 1000000000
}
```

---

### GET /api/bundles?ca={CA}&dev={DEV_WALLET}
Advanced bundle detection. Analyses launch transactions and returns risk scoring.

**Query params:**
- `ca` — token contract address
- `dev` — (optional) dev wallet address for cross-referencing

**Response:**
```json
{
  "bundled": true,
  "pct": "15.20",
  "bundleCount": 2,
  "wallets": 5,
  "jitoConfirmed": true,
  "devBundled": false,
  "newWallets": 2,
  "bundles": [...]
}
```

---

## Public APIs (Free, No Key)

### DexScreener
Market data — price, MC, volume, liquidity, pair info.
```
GET https://api.dexscreener.com/latest/dex/tokens/{CA}
```

### pump.fun
Token metadata — name, image, dev wallet, bonded status, socials.
```
GET https://frontend-api.pump.fun/coins/{CA}
```

### CoinGecko
SOL price for liquidity calculations.
```
GET https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd
```
