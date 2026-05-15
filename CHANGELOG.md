# Changelog

---

## [1.9.0] — 2026-05-14

### Added
- Top Holders deep intel — buy/sell history per holder via Helius Enhanced Transactions
  - Tokens bought + SOL spent (with live USD value)
  - Sell detection: % of position sold + SOL received back
  - Current holding USD value at live MC
  - 🆕 FRESH badge (wallet < 30d old) · 👴 VETERAN badge (180d+ active)

### Fixed
- Dead ticker code — `initTicker()` was fetching prices for 10 tokens every 60s even though the ticker element was removed from the DOM. Guarded with early return — eliminates 10 wasted API calls per minute.
- Bonding curve ETA now uses live SOL price instead of hardcoded $13K — accurate at any SOL price
- All `style="margin-bottom:10px;"` inline overrides removed — now handled by `.card` CSS (10px)
- `stats-4` and `stats-5` margins unified to 10px
- Added `card-sub-label` CSS class for ROI card subtitle

---

## [1.8.0] — 2026-05-14

### Added
- Vamp Coins — detects copycat tokens with same symbol/name (DexScreener search)
  - Shows image, name, 🧛 VAMP badge, MC, 24h%, copy CA button
  - Click any vamp → loads full analysis for that token
  - Clean state: "No vamp coins detected"
- Dev History — traces dev wallet's previous token launches (pump.fun API)
  - Stats: total launched / alive / bonded / dead
  - Reputation badge: SERIAL RUGGER / MIXED / BUILDER / CLEAN / NEW DEV
  - Per-token rows with image, name, status pill, MC, age
  - Click any previous token → loads full analysis
- New API endpoints: `/api/vamps.js`, `/api/dev-history.js`

---

## [1.7.0] — 2026-05-14

### Added
- Moon Score (0–100) — upside potential score alongside Safety Score
  - Signals: momentum, age, MC size, vol/MC ratio, bonded status, 24h change
  - Labels: ❄️ COLD / 🌡️ WARMING / ⚡ HEATING / 🔥 HOT / 🌙 MOON
- Bonding Curve progress bar — % filled + ETA to graduation (pump.fun tokens)
- Quick ROI Calculator — shows $100 return at 2x/5x/10x/50x/100x with MC targets
- Moon Score + Bonding Curve displayed in a single compact 2-panel card

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
