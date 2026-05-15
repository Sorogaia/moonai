# 🌙 MoonAi

> The most complete Solana & pump.fun token analyzer — no API key needed

Paste any contract address or pump.fun link. Get live on-chain data, AI narrative,
safety score, bundle detection, holder intel, and trading tools instantly.
Free. No signup. No key.

---

## Live Site

👉 [https://moonaiapp.xyz](https://moonaiapp.xyz)

---

## Features — V1 Live Now

### Token Overview
- Token image, name, ticker, CA + one-click copy
- Age, holder count, LIVE badge, DexScreener link
- Auto-refresh every 60 seconds with live countdown

### 🌙 Moon Score (0–100)
Upside potential score — **COLD / WARMING / HEATING / HOT / MOON**
- Factors: momentum, age, MC size, vol/MC ratio, bonded status, 24h price change
- Shown with score circle, progress bar, and top signal hints

### ⚡ Bonding Curve Progress *(pump.fun tokens)*
- Live progress bar showing % of bonding curve filled
- ETA to graduation calculated from hourly volume + live SOL price
- Shows "Graduated to Raydium" when bonded

### 🔒 Safety Score (0–100)
Rated **SAFE / CAUTION / WARNING / DANGER**
- Mint authority · Freeze authority · DEV sold tracker
- DEV holdings % · Liquidity depth · Token age · Volume/MC ratio

### 📊 Live Price Bar
Price · 1H · 24H · 5M · Vol 1H · Momentum Score

### 📈 Stats
- MC · VOL 24H · Liquidity · ATH MC (with % down from ATH)
- Bonded · Dev Wallet · Age · Holders · Fresh Wallets %

### 💸 Quick ROI Calculator
$100 invested at 2x / 5x / 10x / 50x / 100x with MC target shown

### 🕵️ Dev History & Reputation
- All previous tokens launched by this dev wallet
- Reputation badge: **SERIAL RUGGER / MIXED / BUILDER / CLEAN / NEW DEV**
- Per-token status: ALIVE / BONDED / DEAD

### 👥 Top Holders — Deep Intel
Real on-chain data via Helius RPC with full buy/sell history:
- **DEV** · 🐋 **WHALE** · 🆕 **FRESH** · 👴 **VETERAN** badges
- Tokens bought + SOL spent (with USD value)
- Sell detection: % of position sold + SOL received
- Current holding USD value at live MC
- Progress bars · Top 3 shown + expandable dropdown

### 🔍 Bundle Detection
Advanced launch analysis — multi-layer approach:
- % of supply bundled at launch
- Jito tip confirmation · Same funding wallet · Same slot grouping
- Per-bundle breakdown with type labels
- LOW / MEDIUM / HIGH risk verdict

### 🧛 Vamp Coins
Detects copycat/duplicate tokens with the same name or symbol:
- Image, name, VAMP badge, MC, 24h%, copy CA
- Click any vamp → loads full analysis

### Socials
Colour-coded pills — Twitter, Telegram, Website

### Top X Posts
Search links — Top Posts · Latest Posts · Dev Twitter account

### Trade & Explore
Axiom · Photon · BullX · Trojan · GMGN · Solscan · GeckoTerminal · pump.fun

### AI Chat
Full token context seeded. Ask anything about the token. Solana/memecoins only.

---

## Advanced Mode
Premium feature — coming in **V2**. Toggle shows a preview of what's included.

---

## V2 Ecosystem (Coming Soon)
- 📱 MoonAi App
- 🤖 Telegram Bot
- 💬 Discord Bot
- 🔐 Subscription model with KOL detection + full tweet display

---

## Usage

1. Go to [moonaiapp.xyz](https://moonaiapp.xyz)
2. Paste any Solana CA or pump.fun link
3. Done

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | HTML / CSS / Vanilla JS |
| Font | Lexend |
| AI | Anthropic Claude (claude-sonnet-4-5) via backend proxy |
| Market data | DexScreener API |
| Token metadata | pump.fun API |
| On-chain data | Helius RPC + Enhanced Transactions |
| SOL price | CoinGecko API |
| Backend | Vercel Serverless Functions |
| Hosting | Vercel + moonaiapp.xyz |
| Rate limiting | Upstash Redis |

---

## Security

- All API keys stored server-side only (Vercel env vars — never in browser)
- Rate limiting on every endpoint via Upstash Redis
- Input validation on all API routes (Solana address format enforced)
- Sanitized error responses — no internal details exposed
- Security headers: X-Frame-Options, X-Content-Type-Options, XSS protection

---

## Team

| | |
|---|---|
| **itsyaboihomelander** | Frontend, UI/UX, product |
| **Sorogaia** | Backend, infrastructure |

---

## License

MIT
