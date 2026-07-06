# Changelog

---

## [Unreleased] — 2026-07-06

### Welcome hero simplification
- Removed the CA copy-pill from the welcome hero (`app.html`).
- Replaced the top circular icon logo above "Live Solana intelligence" with the `wordmark.png` logo, enlarged to 120px for visibility.
- Removed the now-duplicate wordmark image that previously sat below the eyebrow text.

---

## [3.0.0] — 2026-06-25

### Rebrand — MoonAi → Fluxr
- Full project renamed: display text, AI personas, API comments, Redis key prefixes (`moonai:` → `fluxr:`), localStorage keys, Turnstile callbacks, package name, meta/OG tags, GitHub URL, Twitter handle references.
- `moonai-intro.html` renamed to `fluxr-intro.html`.
- Local folder renamed `MOONAI` → `FLUXR`. GitHub repo rename pending.

### Design — Electric Violet palette
- Replaced Solana green (`#14F195`) with electric violet (`#8B5CF6 / rgba(139,92,246)`) as the primary accent across all CSS, inline JS styles, and HTML.
- Secondary cyan (`#00d4ff`) became light violet `#A78BFA`.
- Trencher mode backgrounds gain a subtle violet undertone (`#05030a`, `#0d0b14`, `#110e1a`).
- Intro terminal theme: green-on-black → violet-on-black (bg, grid, cursor, glows, ASCII, enter button).
- Send button text fixed to white (was unreadable black-on-violet).

### UI Polish — rounded, glowing, modern
- Radius scale bumped: `8→12` (sm) · `14→18` (md) · `18→24` (lg) — rounder feel everywhere.
- Cards: persistent violet shadow at rest, stronger lift + glow on hover (`translateY(-2px)`).
- Input wrap: violet ring + ambient glow on `focus-within`, transition restored.
- Header: frosted glass `backdrop-filter` + violet bottom border.
- Bottom bar: violet-tinted bg, stronger blur, violet border.
- Send button: violet glow at rest, pops harder on hover.
- Welcome logo: doubled glow radius.
- Token image: violet ring + ambient glow.
- Lore bubble: violet glow/tint (replaced white glow).
- Toast: violet border + ambient glow.
- Glass cards (trenches, modal, loading, price strip, sendit): violet-tinted bg.
- Token intel cells, ROI items, bstat, dev-hist-stat: all rounder.
- Beta gate: full violet theme.

### Logos
- New branded icon (`logo/icon.png`) — circular XR emblem with lightning bolt and candlestick chart, cyan-to-violet gradient, RGBA transparent.
- New wordmark (`logo/wordmark.png`) — `FLUXR` gradient text with stylised X, RGBA transparent.
- `logo.png` (root) replaced with the new icon (auto-updates favicon, sidebar, OG image, beta gate).
- Welcome hero: icon enlarged (92px), wordmark image replaces `<h1>` text.
- Intro screens (`index.html`, `fluxr-intro.html`): wordmark div renders the image with breathing violet glow animation.
- Sidebar brand icon enlarged to 30px.

### Removed
- **Basic Auth gate** (`middleware.js`) — site is now fully public. Anyone with the link can access it. Removed `SITE_PASSWORD` env var.

---

## [2.6.0] — 2026-06-17

### Changed
- **Free for everyone, unlimited** — removed the wallet-connect + 300-$FLUXR holder gate entirely. No wallet, no signup, no token to hold. AI chat is now unlimited (the old 3-message free cap is gone) and the **Full AI Risk Verdict** is open to all.

### Fixed
- **AI chat could lock up permanently** — non-holders were capped at 3 messages and the only unlock path (holding 300 $FLUXR) could never trigger because the token mint was never configured, so the chat input stayed disabled forever. Removing the gate restores chat for everyone.

### Removed
- `api/_gate.js` and `api/token-gate.js` (HMAC holder-pass + Phantom ownership verification).
- Wallet-connect button, chat message counter, chat-gate banner, and all holder-gate UI/CSS.
- `FLUXR_MINT`, `FLUXR_GATE_MIN`, `GATE_SECRET` env vars (no longer used).

### Security
- `/api/verdict` no longer requires a holder pass; it stays protected by the per-minute rate limit so the Anthropic spend can't be abused.

---

## [2.5.0] — 2026-05-26

### Added
- **Live trenches feed** — new `/api/trending` aggregates pump.fun top-MC, just-launched, and DexScreener top-boosted tokens; cached 60s and injected into every chat as live market context.
- **Streaming chat** — `/api/chat` now streams Anthropic responses as Server-Sent Events. The bubble types out word-by-word with a blinking cursor, first word in ~500ms instead of waiting 3–8s.
- **Free-form chat** — chat works without first analysing a token. Ask about tickers, market trends, KOL plays.
- **Bundle pie chart** — interactive SVG donut with per-bundle tooltip (hover desktop, tap mobile), replaces the old flat list.
- **`/api/lore`** — dedicated fast-narrative endpoint (1–2s, no Turnstile wait, server-controlled prompt).

### Fixed
- **Bundle false positives** — 4-slot bucket + 3-wallet minimum + 0.5% supply floor (was 2 slots / 2 wallets / no floor). Eliminates 10+ noise "Block Sniper" bundles on popular launches.
- **Vamp false positives** — strict regex matching (exact symbol, version variants, word-boundary name matches). MC floor $500 → $5K. Dedup by base CA. No more "WIFI" matching "WIF".
- **Narrative tone** — rewritten to be factual one-liner ("A Solana memecoin themed around X") with no opinions or roasting.
- **ATH inaccurate for migrated tokens** — now scans the OLDEST pool (pump.fun bonding curve) plus top-volume pools using HOUR candles + DAY candles for deep history. Catches pre-migration ATHs that the old code missed entirely.
- **Bonded/Migrated detection** — recognises pumpswap, raydium-clmm, raydium-cpmm, meteora; was only matching `'raydium'`.
- **DEX Paid false negatives** — dual-signal detection (orders + paid-profile indicators). Matches what Axiom shows.
- **Dev holding showing `—`** — `/api/token-info` now auto-falls back to mint authority for the dev lookup when no explicit dev param.
- **Race condition** — `_isStale(ca)` guards after every `await` in per-token fetches; old token's results no longer overwrite new token's UI when user switches fast.
- **Chart embed fail** — chart toggle only renders when `dex.pairAddress` exists; iframe gets a 10s watchdog with a clear fallback message.

### Changed
- **Font**: Geist → Plus Jakarta Sans (warmer, less techy). Addresses use JetBrains Mono via new `--font-addr` variable. Global tabular-numerals for stat alignment without going full mono.
- **Chat tone**: degen-trenches voice (lmao, ngmi, cooked, based, exit liquidity) for free-form chat and token analysis. Narrative stays neutral and factual.
- **Mobile audit**: iOS 100vh → 100dvh, input font 15px → 16px (stops iOS auto-zoom), notch-aware header padding, 44×44 tap targets, theme-color meta, format-detection telephone=no.
- **Ticker polling** pauses when tab hidden.

### Security
- **Timing-safe** beta password comparison via `crypto.timingSafeEqual`.
- **`.env.example` expanded** to document `TURNSTILE_SECRET_KEY`, `BETA_PASSWORD`, `BETA_CODES`, with a clear note on how to disable the beta gate for self-hosting.

### Removed
- Dead `loadExample()` function from `js/app.js`.
- Outdated `Geist, sans-serif` references in `js/beta.js` and `css/styles.css` beta-gate styles.

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
