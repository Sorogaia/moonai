# 🌙 MoonAi

> The most complete Solana & pump.fun token analyzer — no API key needed

Paste any contract address or pump.fun link. Get live on-chain data, AI narrative,
safety score, bundle detection, and holder intel instantly. Free. No signup. No key.

---

## Live Site

👉 [https://moonaiapp.xyz](https://moonaiapp.xyz)

---

## Features — V1 Live Now

### Token Overview
- Token image, name, ticker, CA + one-click copy
- Age, holder count, DexScreener link
- LIVE data badge with auto-refresh every 60s

### Narrative & Analysis
- **Narrative lore bubble** — instant AI one-liner on the token's story
- **✦ Analysis** — deep 8-point narrative analysis on demand (memetic potential, community energy, comparable plays, and more)

### Safety Score (0–100)
Rated **SAFE / CAUTION / WARNING / DANGER**
- Mint authority check
- Freeze authority check
- DEV sold tracker — live on-chain
- DEV holdings %
- Liquidity depth check
- Token age check
- Volume/MC ratio

### Live Price Bar
Price · 1H · 24H · 5M · Vol 1H · Momentum Score

### Stats
- MC · VOL 24H · Liquidity · ATH MC (with % down from ATH)
- Bonded · Dev Wallet · Age · Holders · Fresh Wallets %

### Socials
Colour-coded pills — Twitter, Telegram, Website

### Top Holders
- Real on-chain data via Helius RPC
- DEV badge · 🐋 WHALE badge (≥10%)
- Progress bars per holder
- Top 3 shown + expandable dropdown for full list
- Top 10 concentration warning

### Bundle Detection
Advanced launch analysis — better than most paid tools
- % of supply bundled at launch
- Jito tip confirmation
- Same funding wallet grouping
- Same slot grouping
- Per-bundle breakdown with type labels
- LOW / MEDIUM / HIGH risk verdict

### Trade & Explore
Axiom · Photon · BullX · Trojan · GMGN · Solscan · GeckoTerminal · pump.fun

### Top X Posts
Search links — Top Posts · Latest Posts · Dev Twitter account

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
- 🔐 Subscription model

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
| On-chain data | Helius RPC |
| SOL price | CoinGecko API |
| Backend | Vercel Serverless Functions |
| Hosting | Vercel + moonaiapp.xyz |
| Rate limiting | Upstash Redis |

---

## Team

| | |
|---|---|
| **itsyaboihomelander** | Frontend, UI/UX, product |
| **Sorogaia** | Backend, infrastructure |

---

## License

MIT
