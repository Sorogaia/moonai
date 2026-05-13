# 🌙 MoonAi

> The most complete Solana & pump.fun token analyzer — no API key needed

Paste any contract address or pump.fun link. Get live on-chain data, AI narrative, safety score, bundle detection, holder intel, and full deep analysis — instantly. Free. No signup. No key.

---

## Live Site

👉 [https://moonaiapp.xyz](https://moonaiapp.xyz)

---

## Modes

### 🟢 Trencher Mode
Fast, data-first analysis. Every signal you need in seconds.

- Token image, name, CA + one-click copy
- **Narrative lore bubble** + **✦ Analysis** deep dive on demand
- **Safety Score (0–100)** — SAFE / CAUTION / WARNING / DANGER
- Mint & freeze authority status
- DEV sold tracker — live on-chain balance
- **Price bar** — price, 5M, 1H, 24H, Vol 1H + **Momentum Score**
- **Auto-refresh every 60s** — live countdown
- **ATH MC** — session-tracked all-time high with % down
- Stats — MC, VOL, Liquidity, Supply, Holders
- **Fresh Wallets %** — % of holders with new wallets
- Colour-coded socials — Twitter, Telegram, Website, Discord
- **Top Holders** — real Helius data, progress bars, DEV/WHALE badges, dropdown
- **Bundle Detection** — Jito confirmation, same-funder grouping, risk scoring
- Top X Posts search links
- Trade & Explore — Axiom, Photon, BullX, Trojan, GMGN, Solscan, GeckoTerminal
- AI chat with full token context

### 🟣 Advanced Mode
Full AI deep analysis — every signal, every risk, full alpha.

- Comprehensive AI analysis with structured report
- Verdict + Safety Score
- TH distro with role badges (DEV, INSIDER, KOL, SNIPER, WHALE)
- Buyers panel — Insiders count, KOLs count
- First 10 sniper wallets (IN/OUT)
- Risk flags — LP lock, mint auth, freeze auth, dev sells, wash trading, social signals
- Alpha & trade setup — entry thesis, position size, exit strategy, comparable plays
- On-chain event timeline

### Ecosystem (Coming Soon)
- 📱 MoonAi App — email & Solana wallet login
- 🤖 Telegram Bot
- 💬 Discord Bot

---

## Usage

1. Go to [moonaiapp.xyz](https://moonaiapp.xyz)
2. Paste any Solana CA or pump.fun link
3. Toggle between Trencher and Advanced for different depth

---

## Architecture

```
moonaiapp.xyz
├── Frontend (index.html + css/ + js/)
│   └── No API keys in browser
│
└── Backend (Vercel Serverless)
    ├── /api/chat          → Claude AI proxy (rate-limited)
    ├── /api/holders       → Helius top 10 holders
    ├── /api/bundles       → Bundle detection
    ├── /api/token-info    → Mint/freeze authority + dev balance
    └── /api/fresh-wallets → Fresh wallet % analysis
```

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | HTML / CSS / Vanilla JS |
| Font | Lexend |
| AI | Anthropic Claude via Vercel proxy |
| Market data | DexScreener API |
| Token metadata | pump.fun API |
| On-chain data | Helius RPC |
| SOL price | CoinGecko API |
| Backend | Vercel Serverless (Node.js) |
| Rate limiting | Upstash Redis |
| Hosting | Vercel + moonaiapp.xyz |

---

## Team

| | |
|---|---|
| **itsyaboihomelander** | Frontend, UI/UX, product |
| **Sorogaia** | Backend, infrastructure |

---

## License

MIT
