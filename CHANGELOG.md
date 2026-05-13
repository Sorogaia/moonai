# Changelog

---

## [1.6.0] — 2026-05-14

### Changed
- Full UI cleanup — replaced all inline styles with CSS classes throughout
- Added component CSS: `.tok-header`, `.lore-bubble`, `.analysis-btn`, `.price-bar-*`, `.stats-4/5/3`, `.social-link`, `.trade-link`, `.x-link`, `.holder-row`, `.safety-*`, `.bundle-*`
- Fixed 5-item token details row — now uses proper 5-column grid (was wrapping in 4-col)
- Consistent spacing, animations, and hover states across all cards
- Safety Score, Bundle Detection, Top Holders badges now use CSS badge classes (no inline color styles)
- Removed all structural `display:grid`/`display:flex` inline styles from JS templates

---

## [1.5.0] — 2026-05-14

### Added
- Auto-refresh every 60s with live countdown
- Momentum Score — 5M/1H/6H/24H weighted signal
- 5M price change in price bar
- ATH MC tracking (session-based) with % down
- Fresh Wallets % detection
- Live stat updates without full re-render

---

## [1.4.0] — 2026-05-14

### Added
- Safety Score (0–100) — SAFE / CAUTION / WARNING / DANGER
- DEV sold tracker
- Mint & freeze authority checks
- Copy CA button

---

## [1.3.0] — 2026-05-14

### Added
- Bundle detection with risk scoring
- DEV bundle flag, new wallet signal

---

## [1.2.0] — 2026-05-14

### Added
- Top Holders — progress bars, DEV/WHALE badges, expandable dropdown
- Supply fixed to 1B

---

## [1.1.0] — 2026-05-13

### Added
- Vercel backend proxy — no API key in browser
- Real top holder data via Helius
- Rate limiting

---

## [1.0.0] — 2026-05-13

### Added
- V1 launch — Trencher mode with full live data
- AI narrative lore + deep analysis
- Trade & Explore links, socials, Top X Posts
- MoonAi logo, Lexend font, moonaiapp.xyz
