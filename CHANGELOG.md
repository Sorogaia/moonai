# Changelog

---

## [2.1.0] — 2026-05-17

### Changed
- **Layout: wider shell** — max-width increased from 860px to 1100px
- **Layout: compact stats** — price bar + stats-4 + stats-5 merged into:
  - Slim `price-strip` (borderless, one line: Price | 1H | 24H | 5M | Vol 1H | Momentum | timer)
  - Single `stats-8` grid (8 compact metric cards, priority order: MC → Vol → Liq → ATH → Age → Bonded → Holders → Fresh W.)
- **Base font size** reduced 15px → 14px (scales entire type system proportionally)
- **Card padding** tightened across all cards and metric cards
- **Grid gaps** reduced from 8px → 6px

---

## [2.0.0] — 2026-05-17

### Security (full audit)
- `chat.js`: prompt injection patterns stripped from client context before forwarding to Anthropic
- `_validate.js`: IP extraction switched from spoofable `x-forwarded-for` → `x-vercel-forwarded-for`; added `isValidSymbol()` with alphanumeric regex
- `_ratelimit.js`: added in-memory Map fallback — no longer silently allows all requests when Redis is unavailable
- `vamps.js`: symbol validation now uses `isValidSymbol()` (regex) instead of length-only check
- `fresh-wallets.js`: timestamp input validated against `Date.now()` to prevent overflow/future-date abuse
- `token-history.js`: OHLCV timestamp validated with `parseInt` + `isNaN` guard before processing
- `vercel.json`: added full Content-Security-Policy header; expanded Permissions-Policy

### Added
- `Token Intel` card — 3×3 live-updating grid: Top 10 H. · Dev H. · Bundled % · Holders · Fresh W. · LP Status · Mint Auth · Freeze Auth · Dex Paid
- `Rug Detection + Market Risk` strip — two circles (LOW/MED/HIGH) updating progressively as async scans complete
- `Dex Paid` — DexScreener orders API (`/orders/v1/solana/{ca}`) — ✓ Paid / ✕ Unpaid
- `Bundle Detection CLEAN state` — full PASS/FAIL checklist (Jito, same-funder, same-slot, dev bundled)
- `Vamp Coins + Bundle Detection` 50/50 side-by-side layout
- `updateTokenIntel()` and `updateRiskStrip()` functions — progressively update from `_liveData` as each async call resolves
- `.env.example` — documents all required secrets with placeholders
- In-memory rate limit fallback in `_ratelimit.js`

### Changed
- Moon Score removed from layout (replaced by Rug/Risk Detection strip)
- Safety Score + Dev History moved to bottom of result area
- Top Holders sell line: removed confusing "Sold X% of position" — now shows "Sold Xk · got back Y SOL"
- V2 modal completely rewritten — hype copy, V1 preview framing, TG/Discord IN DEV status, ecosystem section

### Documentation
- `CLAUDE.md` updated with full API table, layout order, security notes, function reference
- `.gitignore` expanded — covers all env files, OS junk, editors, build artifacts, internal folders
- `CONTRIBUTING.md` updated — correct repo URL, multi-file project structure, new rules

---

## [1.10.0] — 2026-05-17

### Added
- Real ATH MC shown as primary value in ALL-TIME HIGH stat card (price as secondary)
- `api/token-history.js` rewritten: uses Helius `getTokenSupply` for exact on-chain supply, scans top-3 pools for highest ATH across all historical data
- `downFromAthMc`, `launchMc`, `mcChangeSinceLaunch` added to API response and `_liveData`
- All historical data seeded into AI chat context (athMc, launchMc, downFromAthMc, mcChangeSinceLaunch)

---

## [1.9.0] — 2026-05-14

### Added
- Top Holders deep intel — buy/sell history per holder via Helius Enhanced Transactions
- Tokens bought + SOL spent (USD value), sell detection, current holding value
- 🆕 FRESH · 👴 VETERAN badges

### Fixed
- Dead ticker code removed (was fetching 10 tokens every 60s wastefully)
- Bonding curve ETA uses live SOL price (was hardcoded)

---

## [1.8.0] — 2026-05-14

### Added
- Vamp Coins — copycat token scanner via DexScreener
- Dev History — previous token launches, reputation badge, per-token status
- `/api/vamps.js`, `/api/dev-history.js`

---

## [1.7.0] — 2026-05-14

### Added
- Moon Score (0–100) — COLD / WARMING / HEATING / HOT / MOON
- Bonding Curve progress + ETA
- Quick ROI Calculator

---

## [1.6.0] — 2026-05-14

### Changed
- Full UI cleanup — all inline styles moved to CSS classes
- Consistent spacing, animations, hover states

---

## [1.5.0] — 2026-05-14

### Added
- Auto-refresh every 60s with countdown
- Momentum Score (5M/1H/6H/24H weighted)
- Fresh Wallets % detection
- ATH MC session tracking

---

## [1.4.0] — 2026-05-14

### Added
- Safety Score (0–100)
- Dev sold tracker, mint/freeze authority checks
- Copy CA button

---

## [1.3.0] — 2026-05-14

### Added
- Bundle detection (risk scoring, dev bundle flag, new wallet signal)

---

## [1.2.0] — 2026-05-14

### Added
- Top Holders — progress bars, DEV/WHALE badges, expandable list

---

## [1.1.0] — 2026-05-13

### Added
- Vercel backend proxy — API keys never in browser
- Real holder data via Helius
- Rate limiting via Upstash Redis

---

## [1.0.0] — 2026-05-13

### Added
- V1 launch — Trencher mode, live data, AI narrative, trade links, socials
