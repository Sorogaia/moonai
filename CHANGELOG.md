# Changelog

---

## [1.4.0] — 2026-05-14 — Safety Score & Token Intel

### Added
- **Safety Score (0–100)** — single verdict card (SAFE / CAUTION / WARNING / DANGER)
- Score factors: mint authority, freeze authority, dev sold, bonded status, liquidity, age, vol/MC ratio
- Visual score circle + progress bar + full signal breakdown
- **DEV sold tracker** — live check if dev wallet emptied tokens, shows SOLD badge or current % held
- **Mint authority check** — is the dev able to mint unlimited tokens?
- **Freeze authority check** — is the dev able to freeze holder wallets?
- **Copy CA button** — one-click copy next to contract address
- `api/token-info.js` — new Vercel endpoint for mint/freeze/dev balance checks

---

## [1.3.0] — 2026-05-14 — Bundle Detection

### Added
- `api/bundles.js` — advanced on-chain bundle detection via Helius
- Bundle Detection card with risk scoring (LOW / MEDIUM / HIGH)
- % of supply bundled, bundle count, wallet count
- Jito confirmation badge, Dev bundled flag, new wallet detection
- Per-bundle breakdown with type labels and progress bars

---

## [1.2.0] — 2026-05-14 — Holders UI

### Added
- Top Holders shows top 3 by default with expandable dropdown
- Progress bars on each holder row
- 🐋 WHALE badge for wallets holding 10%+
- DEV badge on dev wallet in top holders
- Whale concentration warning when top 10 hold 40%+
- Colour-coded % values — red 10%+, amber 5–10%, green under 5%
- HOLDERS stat card updates live after Helius loads

### Fixed
- SUPPLY now always shows `1B` for pump.fun tokens

---

## [1.1.0] — 2026-05-13 — Backend & Infrastructure (Sorogaia)

### Added
- Vercel serverless proxy — API key never in browser
- Helius RPC — real top 10 holder data
- Upstash Redis rate limiting — 20 req/min per IP

---

## [1.0.1] — 2026-05-13 — Repo & Polish

### Added
- OG/Twitter meta tags, favicon
- LICENSE, package.json, .gitignore
- Full docs structure
- Refactored to index.html + css/ + js/
- Custom domain — moonaiapp.xyz

---

## [1.0.0] — 2026-05-13 — V1 Launch

### Added
- Trencher mode — live DexScreener + pump.fun data
- AI narrative lore bubble + deep analysis
- Price bar, stats grid, token details
- Colour-coded socials, Top X Posts, Trade & Explore
- AI follow-up chat with topic guard
- MoonAi logo, Lexend font, Advanced V2 popup
