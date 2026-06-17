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
git clone https://github.com/Sorogaia/moonai.git
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
See `.env.example` for the full list with descriptions.

---

## API Endpoints
| Endpoint | Purpose |
|---|---|
| `POST /api/chat` | AI chat proxy (Anthropic Claude) |
| `POST /api/verdict` | Full AI Risk Verdict — deep structured analysis (free, open to all) |
| `GET /api/holders` | Top 10 holders + buy/sell history |
| `GET /api/bundles` | Bundle/sniper detection |
| `GET /api/token-info` | Mint/freeze auth + dev holdings |
| `GET /api/token-history` | Real ATH + launch data |
| `GET /api/fresh-wallets` | Fresh wallet % at launch |
| `GET /api/vamps` | Copycat token scanner |
| `GET /api/dev-history` | Dev wallet token launch history |

---

## Data Sources Per Token Type
| Data | pump.fun token | Major token (BONK etc.) | Any SPL token |
|---|---|---|---|
| Price/MC/Vol/Liq | DexScreener ✅ | DexScreener ✅ | DexScreener ✅ |
| Name/Symbol/Image | pump.fun ✅ | Jupiter ✅ | DexScreener ✅ |
| Dev wallet | pump.fun ✅ | Mint authority (Helius) ✅ | Mint authority ✅ |
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
| `fetchJupiterMeta(ca)` | Jupiter token API for major tokens |
| `fetchTopHolders(ca, dev, solPrice, mc)` | Helius holder scan |
| `fetchBundleDetection(ca, dev)` | Launch bundle analysis |
| `fetchTokenInfo(ca, dev, dex, pump)` | Mint/freeze/dev holdings |
| `fetchTokenHistory(ca, pair)` | ATH + launch data via GeckoTerminal |
| `fetchFreshWallets(ca, created)` | Fresh wallet % |
| `fetchDevHistory(dev)` | Dev wallet launch history |
| `fetchVampCoins(ca, symbol, name)` | Copycat scanner |
| `fetchDexPaid(ca)` | DexScreener orders API |
| `updateTokenIntel()` | Updates Token Intel 3×3 from `_liveData` |
| `updateRiskStrip()` | Updates Rug/Risk circles from `_liveData` |
| `buildChatSystem()` | AI system prompt from `_liveData` |
| `startAutoRefresh(ca)` | 60s live price refresh |

### `_liveData` global
Accumulates all async scan results. Every fetch function writes to it.
`buildChatSystem()` reads it to seed the AI on every chat message.

---

## Security Notes
- All API keys in Vercel env vars only — never in source
- Rate limiting: Redis → in-memory fallback (never silently open)
- CORS: restricted to `ALLOWED_ORIGIN` env var (default: moonaiapp.xyz)
- IP: `x-vercel-forwarded-for` (Vercel-set, not spoofable)
- Prompt injection regex in `chat.js` applied to both system context and user messages
- Symbol/address validation via regex in `_validate.js`
- CSP headers in `vercel.json`
- All external data escaped before DOM insertion

---

## Twitter
[@Moonai_webApp](https://x.com/Moonai_webApp)
