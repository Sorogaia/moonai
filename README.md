# 🌙 MoonAi

> Real-time Solana & pump.fun token analyzer powered by AI — no API key needed

MoonAi gives you instant, deep analysis on any Solana memecoin. Paste a contract address or pump.fun link and get live on-chain data, AI-powered narrative lore, real holder intel, bundle detection, and trading alpha — all in one place. Free to use, no signup, no key required.

---

## Live Site

👉 [https://moonaiapp.xyz](https://moonaiapp.xyz)

---

## Features

### Trencher Mode (V1 — Live Now)
- **Token header** — live image, name, symbol, CA, age, holder count
- **Narrative lore bubble** — instant AI one-liner on the token's story and vibe
- **✦ Analysis button** — deep narrative analysis on demand
- **Price bar** — current price, 1H & 24H change with buys/sells, Vol 1H
- **Stats grid** — MC, VOL 24H, Liquidity, Supply
- **Token details** — Bonded status, Dev wallet, Age, Holders
- **Socials** — Twitter, Telegram, Website, Discord (colour-coded)
- **Top X Posts** — live search links to Twitter
- **Top Holders** — real top 10 wallets with %, progress bars, DEV/WHALE badges
- **Safety Score** — 0–100 score (SAFE/CAUTION/WARNING/DANGER) with full signal breakdown
- **DEV sold tracker** — live check if dev emptied their wallet, current % held
- **Mint & freeze authority** — is the dev able to mint more or freeze wallets?
- **Copy CA** — one-click copy of contract address
- **Bundle Detection** — advanced on-chain launch analysis with risk scoring
- **Trade & Explore** — Axiom, Photon, BullX, Trojan, GMGN, Solscan, GeckoTerminal, pump.fun
- **AI Chat** — full follow-up chat with token context pre-seeded
- **Topic guard** — Solana/memecoins only

### Advanced Mode
- Premium feature — releasing in **V2**

### Ecosystem (In Development)
- 📱 **MoonAi App** — Exclusive Solana seeker app
- 🤖 **Telegram Bot** — Scan tokens in Telegram
- 💬 **Discord Bot** — MoonAi inside your server

---

## Usage

1. Go to [moonaiapp.xyz](https://moonaiapp.xyz)
2. Paste any Solana CA or pump.fun link
3. Done — no signup, no API key, no install

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | HTML / CSS / Vanilla JS |
| Font | Lexend |
| AI | Anthropic Claude via Vercel proxy |
| Market data | DexScreener API |
| Token metadata | pump.fun API |
| Holder & bundle data | Helius RPC — server-side |
| SOL price | CoinGecko API |
| Backend | Vercel Serverless Functions |
| Rate limiting | Upstash Redis |
| Hosting | Vercel + moonaiapp.xyz |

---

## Project Structure

```
moonai/
├── index.html
├── css/styles.css
├── js/app.js
├── api/
│   ├── chat.js
│   ├── holders.js
│   └── bundles.js
├── vercel.json
├── logo.png
└── docs/
```

---

## Roadmap

### V1 — Live ✅
- [x] Trencher mode with live data
- [x] AI narrative lore + deep analysis
- [x] Real top holder data with DEV/WHALE badges
- [x] Bundle detection with risk scoring
- [x] Vercel backend — no API key required
- [x] Rate limiting
- [x] Custom domain — moonaiapp.xyz

### V2 — In Development 🔧
- [ ] Advanced mode — premium AI analysis
- [ ] KOL detection
- [ ] Top X Posts — full tweet display
- [ ] MoonAi App
- [ ] Telegram & Discord Bot
- [ ] Subscription model

---

## Team

| | |
|---|---|
| **itsyaboihomelander** | Frontend, UI/UX, product |
| **Sorogaia** | Backend, infrastructure |

---

## License

MIT
