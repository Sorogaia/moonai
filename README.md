# 🌙 MoonAi

> Solana & pump.fun token analyzer powered by AI

MoonAi is a real-time token analysis tool for Solana memecoins. Paste any pump.fun contract address or URL and get an instant deep analysis — live on-chain data, AI-powered risk scoring, holder distribution, and trading alpha.

---

## Features

### Trencher Mode (Default)
- Live MC, VOL, ATH from DexScreener
- Dev wallet, bonded status, socials from pump.fun
- Top 10 holder distribution
- Clean, fast, no-fluff output

### Advanced Mode
- Full AI analysis with verdict & safety score (0–100)
- Ticker + name + hourly price change
- Top holder distribution with role badges (DEV, INSIDER, KOL, SNIPER, WHALE)
- Buyers panel: Insiders, KOLs, first 10 snipers (IN/OUT status)
- Risk flags, trading alpha, entry/exit strategy, on-chain timeline

### General
- Solana/memecoin only — topic-locked AI
- Follow-up chat with full context
- Quick action pills
- API key stored locally — never sent to any server

---

## Live Site

👉 [https://itsyaboihomelander.github.io/moonai/](https://itsyaboihomelander.github.io/moonai/)

---

## Setup

1. Open the site
2. Click ⚙ API Key and paste your [Anthropic API key](https://console.anthropic.com)
3. Paste any pump.fun CA or URL
4. Done

---

## Tech Stack

- Vanilla HTML/CSS/JS — single file, zero dependencies
- [Anthropic Claude API](https://anthropic.com) — AI analysis
- [DexScreener API](https://dexscreener.com) — live market data
- [pump.fun API](https://pump.fun) — token metadata
- GitHub Pages — hosting

---

## Roadmap

- [x] Trencher mode — live data cards
- [x] Advanced mode — full AI analysis
- [x] DexScreener + pump.fun API integration
- [x] Topic guard (Solana/memecoins only)
- [ ] Helius integration — real holder data
- [ ] Bundle detection
- [ ] Advanced+ mode
- [ ] Backend proxy — secured API keys
- [ ] Subscription model

---

## License

MIT
