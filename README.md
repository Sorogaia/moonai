# 🌙 MoonAi

> Real-time Solana & pump.fun token analyzer powered by AI

MoonAi is a single-file web app that gives you instant, deep analysis on any Solana memecoin. Paste a contract address or pump.fun link and get live on-chain data, AI-powered narrative lore, risk signals, holder intel, and trading alpha — all in one place.

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
- **Stats grid** — MC, VOL 24H, Liquidity, Supply
- **Token details** — Bonded status, Dev wallet, Age, Holders
- **Socials** — Twitter, Telegram, Website, Discord (colour-coded per platform)
- **KOLs** — Coming in V2
- **Top X Posts** — Top Posts & Latest Posts links direct to Twitter search
- **Top Holders** — Coming in V2 (Helius powered)
- **Trade & Explore** — Axiom, Photon, BullX, Trojan, GMGN, Solscan, GeckoTerminal, pump.fun
- **AI Chat** — Full follow-up chat with token context pre-seeded
- **Quick pills** — Entry strategy, Red flags, Stop loss & targets, Comparable plays
- **Topic guard** — Solana/memecoins only, two-layer enforcement

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

## Setup

1. Open the [live site](https://itsyaboihomelander.github.io/moonai/)
2. Click **⚙ API Key** and paste your [Anthropic API key](https://console.anthropic.com)
3. Paste any Solana CA or pump.fun link
4. Done — no signup, no install

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Vanilla HTML/CSS/JS — single file, zero dependencies |
| Font | Lexend (dyslexic-friendly, modern) |
| AI | Anthropic Claude API (claude-sonnet-4-5) |
| Market data | DexScreener API (free, no key) |
| Token metadata | pump.fun API (free, no key) |
| SOL price | CoinGecko API (free, no key) |
| Hosting | GitHub Pages |

---

## Roadmap

### V1 — Live ✅
- [x] Trencher mode with live data cards
- [x] Token image, name, CA, age display
- [x] Narrative lore bubble (AI one-liner)
- [x] Deep narrative analysis on demand
- [x] Price bar — current price, 1H, 24H, Vol 1H
- [x] DexScreener + pump.fun API integration
- [x] SOL price fetch for liquidity fallback
- [x] Colour-coded social links (Twitter, Telegram, Website, Discord)
- [x] Top X Posts search links
- [x] Trade & Explore links (Axiom, Photon, BullX, Trojan, GMGN, Solscan, GeckoTerminal)
- [x] Topic guard — Solana/memecoins only
- [x] AI follow-up chat with full context
- [x] Lexend font — dyslexic-friendly
- [x] MoonAi logo
- [x] Advanced mode V2 coming soon popup
- [x] Ecosystem preview (App, Telegram Bot, Discord Bot)

### V2 — In Development 🔧
- [ ] Advanced mode — full AI analysis, role badges, snipers, buyers panel
- [ ] Helius integration — real top holder data, dev %, bundle detection
- [ ] KOL detection
- [ ] Top X Posts — full tweet display with views & likes
- [ ] Vercel backend proxy — API keys secured server-side
- [ ] MoonAi App — email & Solana wallet login
- [ ] Telegram Bot
- [ ] Discord Bot
- [ ] Subscription model

---

## License

MIT
