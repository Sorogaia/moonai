# Changelog

All notable changes to MoonAi are documented here.

---

## [1.2.0] — 2026-05-14 — Holders UI & Polish

### Added
- Top Holders shows top 3 by default with expandable dropdown for remaining 7
- Progress bars on each holder row scaled to top holder
- 🐋 WHALE badge for any wallet holding 10%+
- 🔴 DEV badge correctly tags dev wallet in top holders
- Whale concentration warning when top 10 hold 40%+ of supply
- Colour-coded holder % — red 10%+, amber 5–10%, green under 5%
- HOLDERS stat card updates live with real count after Helius loads

### Fixed
- SUPPLY now always shows `1B` — pump.fun tokens are always 1 billion fixed supply
- HOLDERS stat card no longer shows stale "Helius V2" label

---

## [1.1.0] — 2026-05-13 — Backend & Helius (Sorogaia)

### Added
- Vercel serverless backend proxy (`/api/chat`) — Anthropic API key now lives server-side only, never in browser
- Helius RPC integration (`/api/holders`) — real top 10 token holders with wallet addresses and % concentration
- Upstash Redis rate limiting on `/api/chat` — 20 requests/min per IP to prevent abuse
- `vercel.json` — Vercel deployment config (30s function timeout)
- API key modal removed from frontend — users no longer need their own Anthropic key

### Changed
- All Anthropic API calls routed through `/api/chat` proxy
- Top Holders card now shows live real data from Helius
- Frontend no longer stores or transmits API keys

---

## [1.0.1] — 2026-05-13 — Repo & Polish

### Added
- OG/Twitter meta tags for social sharing previews
- Favicon using MoonAi logo
- Improved API key modal with step-by-step guide and cost info
- LICENSE (MIT), package.json, .gitignore, CHANGELOG, CONTRIBUTING
- docs/ folder — SETUP.md, API.md, ROADMAP.md
- Refactored into index.html + css/styles.css + js/app.js for proper code structure

### Changed
- Custom domain set to moonaiapp.xyz
- Hosting moved from GitHub Pages to Vercel

---

## [1.0.0] — 2026-05-13 — V1 Launch

### Added
- Trencher mode — live data cards powered by DexScreener + pump.fun APIs
- Token header with live image, name, symbol, contract address
- Narrative lore bubble — instant AI one-liner on token story and vibe
- ✦ Analysis button — deep 8-point narrative analysis on demand
- Price bar — current price, 1H change, 24H change, Vol 1H with buys/sells
- Stats grid — MC, VOL 24H, Liquidity, Supply
- Token details — Bonded status, Dev wallet, Age, Holders
- Colour-coded social links — Twitter, Telegram, Website, Discord
- Top X Posts section — search links to Twitter
- Trade & Explore links — Axiom, Photon, BullX, Trojan, GMGN, Solscan, GeckoTerminal, pump.fun
- AI follow-up chat with full token context pre-seeded
- Quick suggestion pills — Entry strategy, Red flags, Stop loss, Comparable plays
- Topic guard — two-layer Solana/memecoin only enforcement
- Advanced mode V2 coming soon popup with full feature preview
- Ecosystem preview — MoonAi App, Telegram Bot, Discord Bot
- MoonAi logo with transparent background
- Lexend font — dyslexic-friendly and modern
- SOL price fetch for liquidity fallback on bonding curve tokens
- King of the Hill badge for pump.fun tokens

---

## [Upcoming] — V2

- Advanced mode — full AI analysis, role badges, sniper tracking
- KOL detection
- Bundle detection
- Top X Posts — full tweet display with views & likes
- MoonAi App — email & Solana wallet login
- Telegram Bot
- Discord Bot
- Subscription model
