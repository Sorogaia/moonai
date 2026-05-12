# MoonAi — Project Context

## What This Is
A single-file Solana/pump.fun token analyzer with an AI chatbot.
File: `moonai.html` (entire app — frontend + logic + API calls)

## Live Links
- GitHub: https://github.com/itsyaboihomelander/moonai
- Live site: https://itsyaboihomelander.github.io/moonai

## Git Setup
- Remote: origin → https://github.com/itsyaboihomelander/moonai.git
- Branch: master
- gh CLI path: C:\Program Files\GitHub CLI\gh.exe
- Auto-commit and push after every change

## Two Modes
1. **Trencher** (default) — black/green, real live data cards, no AI cost
2. **Advanced** — midnight purple/gold, full AI analysis with role badges, snipers, etc.

## APIs Currently Used
- DexScreener — free, no key (MC, VOL, ATH, liquidity)
- pump.fun — free, no key (dev wallet, bonded, socials)
- Anthropic Claude — user provides their own key via modal

## What's Built
- [x] Trencher mode — live data cards (DexScreener + pump.fun)
- [x] Advanced mode — full AI analysis, ticker, hourly %, TH distro, snipers, buyers panel
- [x] Topic guard — Solana/memecoins only (client-side + system prompt)
- [x] API key modal — user enters their own Anthropic key
- [x] Mode toggle — iOS-style switch, saves preference
- [x] Advanced+ button — placeholder, wired up later

## What's Next (Priority Order)
1. **Vercel backend proxy** — hide Anthropic + Helius keys server-side (next session)
2. **Helius integration** — real top holder data (addresses + %)
3. **Bundle detection** — friend is building this, goes in Advanced mode
4. **Advanced+ mode** — TBD feature
5. **Subscription model** — when traffic grows

## Key Decisions Made
- One API key owned by the site owner (not per-user keys)
- Keys must be hidden via Vercel serverless functions — never in HTML
- Helius free tier is enough for holder data
- Bundle detection handled separately by a collaborator
- Site stays as a single HTML file for frontend

## Owner
- GitHub: itsyaboihomelander
- Git name: itsyaboihomelander
- Git email: itsyaboihomelander@proton.me
