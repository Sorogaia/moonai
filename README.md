# 🌙 MoonAi

> Solana token intelligence. Built for degens.

Paste any Solana CA or pump.fun link. Get real on-chain data, AI analysis, bundle detection, holder intel, rug/risk scoring, and trading alpha — instantly. Free. No signup. No key required.

**Live → [moonaiapp.xyz](https://moonaiapp.xyz)**  
**Twitter → [@Moonai_webApp](https://x.com/Moonai_webApp)**

---

## Features — V1 Live Now

### Works on ALL Solana tokens
- **pump.fun tokens** — full bonding curve, dev wallet, replies count, King of Hill status
- **Major tokens** (BONK, RAY, WIF, JUP, etc.) — metadata from Jupiter Token API
- **Any SPL token** — DexScreener + Helius on-chain data

### 📊 Live Price Strip
Price · 1H% · 24H% · 5M% · Vol 1H · Momentum · auto-refresh timer

### 📈 Stats Grid — 8 live metrics
MC · Vol 24H · Liquidity · All-Time High MC · Age · Bonded · Holders · Fresh Wallets

### 🕐 Historical Data — From Day 1
- True ATH price + MC (GeckoTerminal OHLCV across top 3 pools, exact on-chain supply)
- Launch MC, launch price, % change since launch
- All-time cumulative volume, ATH date, days since launch

### 🧠 Token Intel Grid — 3×3, live-updating
| Top 10 H. % | Dev Holdings | Bundled % |
|---|---|---|
| Total Holders | Fresh Wallets | LP Status |
| Mint Auth | Freeze Auth | Dex Paid |

### 🔍 Bundle Detection
Multi-layer launch analysis using Helius enhanced transactions:
- Paginates to the actual token creation transaction
- **Jito bundle detection** — all known tip accounts
- **Same funding wallet** — traces buyers to shared source wallets
- **Block sniper groups** — 2-slot bucket grouping catches coordinated bots
- **Still holding tracker** — shows what % of bundled supply is currently held vs dumped
- Real on-chain supply via Helius `getTokenSupply`

### 👥 Top Holders — Deep Intel
- Real total holder count (all non-zero balance accounts)
- DEV · WHALE · FRESH · VETERAN badges
- Buy/sell history per holder (SOL spent, received, current value)

### 🧛 Vamp Coins
Copycat tokens with the same name/symbol — click any to load full analysis

### 🔴 Rug & Risk Detection
Two live circles — Rug Detection + Market Risk (LOW/MED/HIGH)

### 📖 AI Narrative + Chat
- Instant one-sentence narrative on load (claude-haiku)
- Full AI analysis on demand
- Live token context (MC, vol, holders, bundles, ATH, dev history) auto-seeded
- Suggestion pills: Red flags · Stop loss · Entry strategy · ROI · Comparable plays

### 🕵️ Dev History
All previous tokens by this dev: SERIAL RUGGER / MIXED / BUILDER / CLEAN / NEW DEV

### One-click chart
DexScreener embedded chart, lazy-loaded on demand

### Shareable URLs
Every analysis updates the URL hash — share or refresh and land on the same token

---

## V2 — Coming Soon

| Feature | Status |
|---|---|
| Smart money / KOL tracking | In development |
| Telegram Bot | In development |
| Discord Bot | In development |
| Advanced Mode — insider detection, sniper tracking | Planned |
| MoonAi App — mobile, wallet login, push alerts | Planned |

Follow [@Moonai_webApp](https://x.com/Moonai_webApp) for launch updates.

---

## Self-Hosting / Contributing

### Prerequisites
- Node.js 18+
- Vercel CLI (`npm i -g vercel`)
- Accounts: Helius (free tier), Anthropic, Upstash Redis

### Local Development
```bash
git clone https://github.com/Sorogaia/moonai.git
cd moonai
cp .env.example .env.local   # fill in your keys
npx vercel dev               # full stack with APIs
# or: npx live-server .      # frontend only (no API features)
```

### Required Environment Variables
See `.env.example` for the full list. Set in Vercel dashboard for production — never commit real values.

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Claude AI chat |
| `HELIUS_API_KEY` | Solana RPC + enhanced tx data |
| `UPSTASH_REDIS_REST_URL` | Distributed rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | Rate limiting auth |
| `ALLOWED_ORIGIN` | CORS allowed origin (default: https://moonaiapp.xyz) |

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | HTML · CSS · Vanilla JS |
| Font | Lexend (Google Fonts) |
| AI | Anthropic Claude — server-side proxy |
| Market data | DexScreener API · GeckoTerminal OHLCV |
| Token metadata | pump.fun API · Jupiter Token API |
| On-chain | Helius RPC + Enhanced Transactions API |
| SOL price | Jupiter Price API · CoinGecko |
| Rug check | Rugcheck.xyz API |
| Backend | Vercel Serverless (Node.js) |
| Rate limiting | Upstash Redis + in-memory Map fallback |

---

## Security

- All API keys server-side only — Vercel env vars, never in the browser
- CORS locked to `ALLOWED_ORIGIN` — only the production domain can call the API
- Rate limiting: Redis primary, in-memory fallback — never silently open
- IP extraction via `x-vercel-forwarded-for` (Vercel-set, cannot be spoofed)
- Prompt injection stripped from both system context and user messages
- All external data HTML-escaped before DOM insertion
- Strict input validation — Solana address regex, symbol regex, timestamp bounds
- CSP + security headers via `vercel.json`

---

## License
MIT
