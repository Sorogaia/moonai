# MoonAi — Contributor Guide

## What This Is
A real-time Solana & pump.fun token analyzer. Paste any CA or pump.fun link
and get live market data, AI narrative, safety score, bundle detection,
holder intel, rug/risk detection, token intel, and trading tools — instantly.
Free. No signup. Live at https://moonaiapp.xyz

---

## Source of Truth Files
| File | Purpose |
|---|---|
| `index.html` | HTML shell — structure, V2 modal, welcome screen |
| `css/styles.css` | All styles — never write inline styles, always edit here |
| `js/app.js` | All frontend logic — fetching, rendering, AI chat, live updates |
| `api/*.js` | Vercel serverless functions — backend proxies & business logic |
| `api/_validate.js` | Shared input validation + IP extraction (not a public route) |
| `api/_ratelimit.js` | Redis + in-memory rate limiting (not a public route) |
| `vercel.json` | Deployment config, security headers, function timeouts |
| `.env.example` | Documents required secrets — never commit real values |

> **Do not edit `moonai.html`** — legacy reference file, excluded from repo.

---

## Running Locally
```bash
git clone https://github.com/itsyaboihomelander/moonai.git
cd moonai
npx live-server .
```
For local API testing (AI chat, holders, bundles, etc.):
```bash
npx vercel dev
```
Requires `.env.local` with real API keys — see `.env.example` for the list.

---

## Deployment
Hosted on Vercel. Connected to GitHub — push to `master` → auto-deploy.
Manual deploy: `npx vercel --prod` (requires `npx vercel login` first if token expired)

---

## Environment Variables
**Never commit real values.** Set exclusively in Vercel dashboard → Project Settings → Environment Variables.
See `.env.example` for the full list.

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Claude AI — powers chat responses |
| `HELIUS_API_KEY` | Solana RPC + enhanced transaction data |
| `UPSTASH_REDIS_REST_URL` | Distributed rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | Rate limiting auth token |

---

## API Endpoints
| Endpoint | Purpose | Rate Limit |
|---|---|---|
| `POST /api/chat` | AI chat proxy (Anthropic Claude) | 20/min/IP |
| `GET /api/holders` | Top 10 holders + buy/sell history | 30/min/IP |
| `GET /api/bundles` | Jito/same-funder/same-slot bundle detection | 30/min/IP |
| `GET /api/token-info` | Mint/freeze authority + dev holdings | 60/min/IP |
| `GET /api/token-history` | Real ATH, launch price, all-time vol (GeckoTerminal) | 30/min/IP |
| `GET /api/fresh-wallets` | Fresh wallet % at launch | 60/min/IP |
| `GET /api/vamps` | Similar/copycat token scanner | 30/min/IP |
| `GET /api/dev-history` | Dev wallet transaction timeline | 20/min/IP |

---

## Frontend Architecture
All frontend logic lives in `js/app.js`. Key functions:

| Function | Purpose |
|---|---|
| `runAnalysis(raw)` | Entry point — extracts CA, fires all fetches |
| `renderTrencher(ca, dex, pump, solPrice)` | Builds the full result HTML |
| `fetchDexScreener(ca)` | Live price, MC, vol, liquidity from DexScreener |
| `fetchPumpFun(ca)` | Token metadata, dev, bonding curve from pump.fun |
| `fetchTopHolders(ca, dev, solPrice, mc)` | Helius holder scan with buy/sell history |
| `fetchBundleDetection(ca, dev)` | Launch bundle analysis via Helius |
| `fetchTokenInfo(ca, dev, dex, pump)` | Mint/freeze/dev holdings via Helius RPC |
| `fetchTokenHistory(ca, pair)` | Historical ATH + launch data via GeckoTerminal |
| `fetchFreshWallets(ca, created)` | Fresh wallet detection at launch |
| `fetchDevHistory(dev)` | Dev wallet transaction history |
| `fetchVampCoins(ca, symbol, name)` | Copycat token scan via DexScreener |
| `fetchDexPaid(ca)` | DexScreener payment status via orders API |
| `fetchLoreBubble(...)` | AI narrative generation |
| `updateTokenIntel()` | Updates Token Intel 3×3 grid from `_liveData` |
| `updateRiskStrip()` | Updates Rug/Risk detection circles from `_liveData` |
| `buildChatSystem()` | Builds AI system prompt from all live `_liveData` |
| `startAutoRefresh(ca)` | 30s live price refresh loop |

### `_liveData` global object
Accumulates all async data for AI chat context. Updated by every fetch function.
`buildChatSystem()` reads from it to construct the AI system prompt on every message.

---

## Current Layout Order (Trencher mode)
1. Token header (image, name, CA, copy, LIVE badge, DexScreener link)
2. Trade links (Axiom, Photon, BullX, Trojan, GMGN, Solscan, GeckoTerminal, pump.fun)
3. Narrative bubble + Analysis button
4. Price strip (Price | 1H | 24H | 5M | Vol 1H | Momentum | refresh timer)
5. Stats 8-grid (MC | Vol 24H | Liq | ATH | Age | Bonded | Holders | Fresh W.)
6. Launch info bar (Launch MC, % change since launch, all-time vol, ATH date)
7. Token Intel card — 3×3 grid (Top 10 H. | Dev H. | Bundled % | Holders | Fresh W. | LP Status | Mint Auth | Freeze Auth | Dex Paid)
8. ROI Calculator (hidden — revealed via suggestion pill)
9. Socials | KOLs (V2) | Top X Posts (V2) — 3-column
10. Vamp Coins + Bundle Detection — 50/50 side by side
11. Top Holders (buy/sell/wallet age per holder)
12. Description (pump.fun description if available)
13. Safety Score (hidden — revealed via suggestion pill)
14. Rug Detection + Market Risk strip (live circles, async-updated)
15. Dev History

---

## Security Notes
- All API keys in env vars only — never in source code
- Rate limiting: Upstash Redis primary → in-memory Map fallback (never silently allows all)
- IP extraction uses `x-vercel-forwarded-for` (Vercel-set, cannot be spoofed by client)
- Prompt injection patterns stripped from client context in `chat.js` before forwarding to Anthropic
- Symbol validation uses alphanumeric regex, not just length check
- Timestamp inputs validated against `Date.now()` to prevent overflow abuse
- CSP, X-Frame-Options, X-Content-Type-Options headers set in `vercel.json`

---

## Team
- **itsyaboihomelander** — frontend, UI/UX, product
- **Sorogaia** — backend, infrastructure

## Twitter
[@Moonai_webApp](https://x.com/Moonai_webApp)
