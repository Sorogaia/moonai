# 🌙 MoonAi

> Real-time Solana & pump.fun token analyzer powered by AI — no API key needed

MoonAi gives you instant, deep analysis on any Solana memecoin. Paste a contract address or pump.fun link and get live on-chain data, AI-powered narrative lore, real holder intel, and trading alpha — all in one place. Free to use, no signup, no key required.

---

## Live Site

👉 [https://moonaiapp.xyz](https://moonaiapp.xyz)

---

## Features

### Trencher Mode (V1 — Live Now)
- **Token header** — live image, name, symbol, CA, age, holder count
- **Narrative lore bubble** — instant AI one-liner on the token's story and vibe
- **✦ Analysis button** — deep 8-point narrative analysis on demand
- **Price bar** — current price, 1H change + buys/sells, 24H change + buys/sells, Vol 1H
- **Stats grid** — MC, VOL 24H, Liquidity, Supply (1B fixed for pump.fun tokens)
- **Token details** — Bonded status, Dev wallet, Age, Holders
- **Socials** — Twitter, Telegram, Website, Discord (colour-coded per platform)
- **KOLs** — Coming in V2
- **Top X Posts** — Top Posts & Latest Posts links to Twitter search
- **Top Holders** — Real top 10 wallets with % via Helius RPC
- **Trade & Explore** — Axiom, Photon, BullX, Trojan, GMGN, Solscan, GeckoTerminal, pump.fun
- **AI Chat** — Full follow-up chat with token context pre-seeded
- **Quick pills** — Entry strategy, Red flags, Stop loss & targets, Comparable plays
- **Topic guard** — Solana/memecoins only, two-layer enforcement
- **Rate limiting** — 20 req/min per IP via Upstash Redis

### Advanced Mode
- Locked — Premium feature releasing in **V2**
- Full AI risk score & verdict
- Holder distribution with role badges (DEV, INSIDER, KOL, SNIPER, WHALE)
- Insider & KOL detection
- First 10 sniper wallets (IN / OUT status)
- Hourly price momentum
- Bundle detection

### Ecosystem (In Development)
- 📱 **MoonAi App** — Exclusive Solana seeker app (email & wallet login in V2)
- 🤖 **Telegram Bot** — Scan tokens directly in Telegram
- 💬 **Discord Bot** — MoonAi analysis inside your server

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
| Font | Lexend — dyslexic-friendly, modern |
| AI | Anthropic Claude (claude-sonnet-4-5) via Vercel proxy |
| Market data | DexScreener API — free, no key |
| Token metadata | pump.fun API — free, no key |
| Holder data | Helius RPC — server-side, key hidden |
| SOL price | CoinGecko API — free, no key |
| Backend | Vercel Serverless Functions (Node.js) |
| Rate limiting | Upstash Redis |
| Hosting | Vercel + custom domain (moonaiapp.xyz) |

---

## Architecture

```
moonaiapp.xyz
├── Frontend (index.html + css/ + js/)
│   └── No API keys — calls /api/* endpoints only
│
└── Backend (Vercel Serverless)
    ├── /api/chat      → proxies Anthropic API (rate-limited)
    └── /api/holders   → proxies Helius RPC (top 10 holders)
```

All API keys live in Vercel environment variables — never in the browser.

---

## Project Structure

```
moonai/
├── index.html          # App shell
├── css/styles.css      # All styles (750 lines)
├── js/app.js           # Frontend logic (1500+ lines)
├── api/
│   ├── chat.js         # Anthropic proxy + rate limiting
│   └── holders.js      # Helius top holders proxy
├── vercel.json         # Vercel config
├── logo.png
├── README.md
├── CHANGELOG.md
├── CONTRIBUTING.md
├── LICENSE
├── package.json
└── docs/
    ├── SETUP.md
    ├── API.md
    └── ROADMAP.md
```

---

## Roadmap

### V1 — Live ✅
- [x] Trencher mode — live data cards
- [x] Token image, name, CA, age display
- [x] Narrative lore bubble + Analysis button
- [x] Price bar — current price, 1H, 24H, Vol 1H
- [x] DexScreener + pump.fun + CoinGecko API integration
- [x] Colour-coded social links
- [x] Top X Posts search links
- [x] Trade & Explore links
- [x] Topic guard — Solana/memecoins only
- [x] AI follow-up chat
- [x] Lexend font — dyslexic-friendly
- [x] MoonAi logo + custom domain (moonaiapp.xyz)
- [x] Advanced mode V2 coming soon popup
- [x] Ecosystem preview (App, Telegram Bot, Discord Bot)
- [x] Vercel backend proxy — API keys secured server-side
- [x] Helius integration — real top 10 holder data
- [x] Rate limiting — Upstash Redis, 20 req/min per IP
- [x] No API key required from users

### V2 — In Development 🔧
- [ ] Advanced mode — full AI analysis, role badges, snipers, buyers panel
- [ ] KOL detection
- [ ] Bundle detection
- [ ] Top X Posts — full tweet display with views & likes
- [ ] MoonAi App — email & Solana wallet login
- [ ] Telegram Bot
- [ ] Discord Bot
- [ ] Subscription model

---

## Team

| | |
|---|---|
| **itsyaboihomelander** | Frontend, UI/UX, product |
| **Sorogaia** | Backend, Vercel infrastructure, Helius integration |

---

## License

MIT
