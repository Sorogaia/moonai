# Changelog

---

## [2.3.0] — 2026-05-17

### Added
- **Jupiter Token API** — fetched in parallel for every token scan (no API key, free public API)
  - Covers BONK, RAY, WIF, POPCAT, BAGS, and all Jupiter-verified Solana tokens
  - Fills in: token name, symbol, logo, description, Twitter, Telegram, Discord, Website
  - Description card now shows Jupiter descriptions for major tokens
  - Narrative AI receives Jupiter description as context for non-pump.fun tokens
  - Logo image falls back to Jupiter `logoURI` if DexScreener has none

- **Non-pump.fun dev wallet display** — when no pump.fun dev address exists, shows mint authority address tagged as `CREATOR` with revoked/active status; automatically triggers Dev History scan on that creator

- **LP Status improved** — shows `Raydium` (amber) for non-pump.fun tokens on Raydium instead of `—`

- **Social links now fully merged** — pump.fun → Jupiter extensions → DexScreener, in that priority order; covers Discord, Instagram as Jupiter-sourced extras

---

## [2.2.0] — 2026-05-17

### Fixed — Bundle Detection (major accuracy overhaul)
- **Root cause**: was fetching only 100 most-recent transactions then taking the oldest 30 of those. For active tokens with 700+ holders the actual launch buys were hundreds of transactions further back — we never saw them.
- Now paginates `getSignaturesForAddress` up to 4 pages × 1000 sigs = 4000 signatures until it reaches the token's very first transaction
- Launch window widened: 15 slots (~6 sec) → **300 slots (~2 min)** — catches coordinated multi-wave buys
- Launch transactions analyzed: 30 → **100**
- Funding wallet traced for top 20 buyers (was top 10)
- Slot grouping: exact same-slot only → **2-slot buckets (~800ms)** to catch split bundles
- Token supply: hardcoded 1B → **real on-chain supply from Helius `getTokenSupply`**
- Response now includes `_meta` debug field: `totalSigsScanned`, `launchTxnsAnalyzed`, `creationSlot`, `launchWindowSlots`, `totalSupply`

---

## [2.1.0] — 2026-05-17

### Changed
- Shell max-width: 860px → 1100px (25% wider)
- Base font: 15px → 14px (scales entire type system)
- Price card replaced with slim borderless `price-strip` (one line: Price | 1H | 24H | 5M | Vol 1H | Momentum | timer)
- `stats-4` + `stats-5` merged into single `stats-8` grid (priority order: MC → Vol → Liq → ATH → Age → Bonded → Holders → Fresh W.)
- Card padding, metric card padding, and grid gaps all tightened
- Removes one full row of vertical scroll

---

## [2.0.0] — 2026-05-17

### Security audit + major feature release
- Prompt injection hardening in `chat.js`
- IP spoofing fix: `x-forwarded-for` → `x-vercel-forwarded-for`
- Rate limit in-memory fallback when Redis unavailable
- Symbol validation: length-only → alphanumeric regex
- Timestamp input validation in `fresh-wallets.js`
- OHLCV timestamp NaN guard in `token-history.js`
- Content-Security-Policy added to `vercel.json`
- Token Intel 3×3 grid (Top 10 H. · Dev H. · Bundled % · Holders · Fresh W. · LP Status · Mint Auth · Freeze Auth · Dex Paid)
- Rug Detection + Market Risk circles (live-updating, LOW/MED/HIGH)
- Vamp Coins + Bundle Detection 50/50 side-by-side
- Bundle Detection CLEAN state with PASS/FAIL checklist
- Dex Paid via DexScreener orders API
- `.env.example` added
- All docs rewritten

---

## [1.10.0] — 2026-05-17

### Added
- Real ATH MC as primary value — Helius `getTokenSupply` + top-3 pool OHLCV scan
- `downFromAthMc`, `launchMc`, `mcChangeSinceLaunch` in API + AI context

---

## [1.9.0] — 2026-05-14

### Added
- Top Holders deep intel via Helius Enhanced Transactions
- FRESH · VETERAN badges, buy/sell history, wallet age

---

## [1.8.0] — 2026-05-14

### Added
- Vamp Coins scanner, Dev History with reputation badge
- `/api/vamps.js`, `/api/dev-history.js`

---

## [1.7.0] — 2026-05-14

### Added
- Moon Score (0–100), Bonding Curve progress + ETA, ROI Calculator

---

## [1.6.0] — 2026-05-14

### Changed
- Full CSS refactor — all inline styles moved to classes

---

## [1.5.0] — 2026-05-14

### Added
- Auto-refresh 60s, Momentum Score, Fresh Wallets %, session ATH

---

## [1.4.0] — 2026-05-14

### Added
- Safety Score (0–100), dev sold tracker, mint/freeze auth checks

---

## [1.3.0] — 2026-05-14

### Added
- Bundle detection with Jito/same-funder/same-slot detection

---

## [1.2.0] — 2026-05-14

### Added
- Top Holders, DEV/WHALE badges, expandable list

---

## [1.1.0] — 2026-05-13

### Added
- Vercel backend proxy, real Helius holder data, Upstash rate limiting

---

## [1.0.0] — 2026-05-13

### Added
- V1 launch — Trencher mode, live data, AI narrative, trade links, socials
