# MoonAi — Contributor Guide

## What This Is
A real-time Solana & pump.fun token analyzer. Paste any CA or pump.fun link
and get live on-chain data, AI narrative, bundle detection, holder intel,
rug/risk detection, and trading tools — instantly. Free. No signup.
Live at https://moonaiapp.xyz

---

## Source of Truth Files
| File | Purpose |
|---|---|
| `index.html` | HTML shell — structure, V2 modal, welcome screen |
| `css/styles.css` | All styles — never write inline styles, always edit here |
| `js/app.js` | All frontend logic — fetching, rendering, AI chat, live updates |
| `api/*.js` | Vercel serverless functions — backend proxies |
| `api/_validate.js` | Shared input validation + IP extraction (not a public route) |
| `api/_ratelimit.js` | Redis + in-memory fallback rate limiting (not a public route) |
| `vercel.json` | Deployment config, security headers, function timeouts |
| `.env.example` | Documents required secrets — never commit real values |

> **Do not edit `moonai.html`** — legacy reference, excluded from repo.

---

## Running Locally
```bash
git clone https://github.com/itsyaboihomelander/moonai.git
cd moonai
npx live-server .          # frontend only
npx vercel dev             # full stack with APIs (needs .env.local)
```
Copy `.env.example` → `.env.local` and fill in real keys for API features.

---

## Deployment
Hosted on Vercel. Push to `master` → auto-deploy (via GitHub integration).
Manual: `npx vercel --prod` (run `npx vercel login` first if token expired)

---

## Environment Variables
Set exclusively in Vercel dashboard. Never commit real values.

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Claude AI chat responses |
| `HELIUS_API_KEY` | Solana RPC + enhanced transaction data |
| `UPSTASH_REDIS_REST_URL` | Distributed rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | Rate limiting auth |

---

## API Endpoints
| Endpoint | Purpose | Rate Limit |
|---|---|---|
| `POST /api/chat` | AI chat proxy (Anthropic Claude) | 20/min/IP |
| `GET /api/holders` | Top 10 holders + buy/sell history | 30/min/IP |
| `GET /api/bundles` | Bundle/sniper detection | 30/min/IP |
| `GET /api/token-info` | Mint/freeze auth + dev holdings | 60/min/IP |
| `GET /api/token-history` | Real ATH + launch data (GeckoTerminal) | 30/min/IP |
| `GET /api/fresh-wallets` | Fresh wallet % at launch | 60/min/IP |
| `GET /api/vamps` | Copycat token scanner | 30/min/IP |
| `GET /api/dev-history` | Dev wallet token launch history | 20/min/IP |

---

## Bundle Detection Algorithm (v2.2)
`api/bundles.js` — most critical accuracy component.

1. **Paginate to launch** — `getSignaturesForAddress` up to 4 pages × 1000 = 4000 sigs; stops when page < 1000 (reached beginning)
2. **Identify creation slot** — oldest signature's slot = `creationSlot`
3. **Launch window** — 300 slots (~2 min) from `creationSlot`
4. **Analyze 100 launch txns** via Helius Enhanced Transactions API
5. **Detect patterns**:
   - Jito tip account transfers in same tx (8 known tip accounts)
   - Same funding wallet traced for top 20 buyers
   - 2-slot bucket grouping for adjacent-slot bundles
6. **Real supply** — `getTokenSupply` from Helius, fallback 1B
7. **Response** includes `_meta` debug info (totalSigsScanned, launchTxnsAnalyzed, creationSlot)

---

## Data Sources Per Token Type
| Data | pump.fun token | Major token (BONK etc.) | Any SPL token |
|---|---|---|---|
| Price/MC/Vol/Liq | DexScreener ✅ | DexScreener ✅ | DexScreener ✅ |
| Name/Symbol/Image | pump.fun ✅ | Jupiter ✅ | DexScreener ✅ |
| Description | pump.fun ✅ | Jupiter ✅ | — |
| Socials | pump.fun + DexScreener ✅ | Jupiter + DexScreener ✅ | DexScreener ✅ |
| Dev wallet | pump.fun ✅ | Mint authority (Helius) ✅ | Mint authority ✅ |
| Bonding curve | pump.fun ✅ | N/A | N/A |
| Holders/bundles | Helius ✅ | Helius ✅ | Helius ✅ |
| ATH/launch data | GeckoTerminal ✅ | GeckoTerminal ✅ | GeckoTerminal ✅ |

---

## Frontend Architecture
Key functions in `js/app.js`:

| Function | Purpose |
|---|---|
| `runAnalysis(raw)` | Entry point — extracts CA, fires all fetches |
| `renderTrencher(ca, dex, pump, solPrice, jup)` | Builds full result HTML |
| `fetchDexScreener(ca)` | Price, MC, vol, liquidity, socials |
| `fetchPumpFun(ca)` | pump.fun metadata, dev, bonding curve |
| `fetchJupiterMeta(ca)` | Jupiter token API — description, socials for major tokens |
| `fetchTopHolders(ca, dev, solPrice, mc)` | Helius holder scan |
| `fetchBundleDetection(ca, dev)` | Launch bundle analysis |
| `fetchTokenInfo(ca, dev, dex, pump)` | Mint/freeze/dev — also shows mint auth as creator |
| `fetchTokenHistory(ca, pair)` | ATH + launch data via GeckoTerminal |
| `fetchFreshWallets(ca, created)` | Fresh wallet % |
| `fetchDevHistory(dev)` | Dev wallet launch history |
| `fetchVampCoins(ca, symbol, name)` | Copycat scanner |
| `fetchDexPaid(ca)` | DexScreener orders API |
| `fetchLoreBubble(...)` | AI narrative |
| `updateTokenIntel()` | Updates Token Intel 3×3 from `_liveData` |
| `updateRiskStrip()` | Updates Rug/Risk circles from `_liveData` |
| `buildChatSystem()` | AI system prompt from `_liveData` |
| `startAutoRefresh(ca)` | 30s live price refresh |

### `_liveData` global
Accumulates all async scan results. Every fetch function writes to it.
`buildChatSystem()` reads it to seed the AI on every chat message.

---

## Current Layout Order (Trencher mode)
1. Token header (image, name, CA, copy, LIVE badge, age, DexScreener link)
2. Trade links row (Axiom, Photon, BullX, Trojan, GMGN, Solscan, GeckoTerminal, pump.fun)
3. Narrative bubble + Analysis button
4. Price strip (Price | 1H | 24H | 5M | Vol 1H | Momentum | timer)
5. Stats-8 grid (MC | Vol 24H | Liq | ATH | Age | Bonded | Holders | Fresh W.)
6. Launch info bar (Launch MC, % change, all-time vol, ATH date)
7. Token Intel 3×3 (Top 10 H. | Dev H. | Bundled % | Holders | Fresh W. | LP Status | Mint Auth | Freeze Auth | Dex Paid)
8. ROI Calculator (hidden — suggestion pill)
9. Socials | KOLs (V2) | Top X Posts (V2)
10. Vamp Coins + Bundle Detection (50/50)
11. Top Holders
12. Description (pump.fun or Jupiter)
13. Safety Score (hidden — suggestion pill)
14. Rug Detection + Market Risk strip
15. Dev History

---

## Security Notes
- Keys in env vars only — never in source
- Rate limiting: Redis → in-memory fallback (never silently open)
- IP: `x-vercel-forwarded-for` (Vercel-set, not spoofable)
- Prompt injection regex in `chat.js` before Anthropic forward
- Symbol validation: alphanumeric regex in `_validate.js`
- Timestamp bounds checked in `fresh-wallets.js`
- CSP headers in `vercel.json`

---

## Team
- **itsyaboihomelander** — frontend, UI/UX, product
- **Sorogaia** — backend, infrastructure

## Twitter
[@Moonai_webApp](https://x.com/Moonai_webApp)
