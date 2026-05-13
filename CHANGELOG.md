# Changelog

---

## [2.0.0] — 2026-05-14 — V2 Launch 🚀

### Added
- **Advanced Mode unlocked** — full AI deep analysis: verdict, score, TH distro with role badges (DEV/INSIDER/KOL/SNIPER/WHALE), buyers panel, sniper tracking, risks, alpha, timeline
- **Auto-refresh** — live price data updates every 60 seconds, countdown timer shown
- **Momentum Score** — weighted 5M/1H/6H/24H momentum: 🔥 HOT / ⬆ RISING / ➡ NEUTRAL / ⬇ COOLING / 🧊 COLD
- **5M price change** — added to price bar
- **ATH MC tracking** — session-based all-time high MC with % down from ATH
- **Fresh Wallets %** — % of top holders with newly created wallets (farm detection)
- `api/fresh-wallets.js` — Vercel endpoint for fresh wallet analysis

### Changed
- Advanced mode toggle now switches modes (was blocked by "Coming Soon" popup)
- V2 popup replaced with ecosystem preview modal
- Stats grid now live-updating without full re-render

---

## [1.4.0] — 2026-05-14 — Safety Score & Token Intel

### Added
- Safety Score (0–100) — SAFE / CAUTION / WARNING / DANGER
- DEV sold tracker — live wallet balance check
- Mint & freeze authority checks
- Copy CA button
- `api/token-info.js`

---

## [1.3.0] — 2026-05-14 — Bundle Detection

### Added
- Advanced on-chain bundle detection via Helius
- Jito confirmation, same-funder grouping, dev bundle flag, new wallet detection
- `api/bundles.js`

---

## [1.2.0] — 2026-05-14 — Holders UI

### Added
- Top 3 holders shown by default with expandable dropdown
- Progress bars, WHALE/DEV badges, concentration warning

---

## [1.1.0] — 2026-05-13 — Backend & Infrastructure (Sorogaia)

### Added
- Vercel backend proxy — API key never in browser
- Helius RPC — real top 10 holder data
- Upstash Redis rate limiting

---

## [1.0.0] — 2026-05-13 — V1 Launch

### Added
- Trencher mode — full live data pipeline
- AI narrative lore + deep analysis
- Colour-coded socials, Top X Posts, Trade & Explore
- MoonAi logo, Lexend font, custom domain
