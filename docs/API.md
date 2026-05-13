# API Reference

MoonAi uses a mix of free public APIs and secured backend proxies.

---

## Backend Endpoints (Vercel)

### POST /api/chat
Proxies Anthropic Claude API server-side. API key never exposed to browser.

**Rate limit:** 20 requests/min per IP (Upstash Redis)

**Request body:**
```json
{
  "model": "claude-sonnet-4-5",
  "max_tokens": 2000,
  "system": "...",
  "messages": [{ "role": "user", "content": "..." }]
}
```

**Response:** Anthropic API response (passthrough)

---

### GET /api/bundles?ca={CA}
Detects coordinated Jito bundles in the token's launch window via Helius enhanced transactions.

**Query params:**
- `ca` — Solana token contract address

**Response:**
```json
{
  "bundled": true,
  "pct": "15.20",
  "bundleCount": 2,
  "wallets": 5,
  "bundles": [
    { "slot": 123456, "wallets": ["Ab3c…xYz1", "..."], "amount": 95000000, "pct": "9.50" }
  ]
}
```

---

### GET /api/holders?ca={CA}
Fetches top 10 token holders via Helius RPC. Helius key never exposed to browser.

**Query params:**
- `ca` — Solana token contract address

**Response:**
```json
{
  "holders": [
    { "owner": "wallet...", "tokenAccount": "...", "amount": 1234567, "pct": 1.23 }
  ],
  "totalSupply": 1000000000
}
```

---

## Public APIs (Free, No Key)

### DexScreener
Used for: MC, price, volume, liquidity, 1H/24H changes, buys/sells, pair URL, token image, socials.
```
GET https://api.dexscreener.com/latest/dex/tokens/{CA}
```

### pump.fun
Used for: token name, symbol, description, image, dev wallet, bonded status, Twitter, Telegram, website.
```
GET https://frontend-api.pump.fun/coins/{CA}
```

### CoinGecko
Used for: live SOL price (liquidity fallback for bonding curve tokens).
```
GET https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd
```
