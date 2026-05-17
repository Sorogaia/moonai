# 🌙 MoonAi

> Solana token intelligence. Built for degens.

Paste any Solana CA or pump.fun link. Get real on-chain data, AI analysis, bundle detection, holder intel, rug/risk scoring, and trading alpha — instantly. Free. No signup. No key required.

**Live → [moonaiapp.xyz](https://moonaiapp.xyz)**
**Twitter → [@Moonai_webApp](https://x.com/Moonai_webApp)**

---

## Features — V1 Live Now

### Token Overview
- Token image, name, ticker, full CA + one-click copy
- LIVE badge, age, DexScreener link
- Trade links: Axiom · Photon · BullX · Trojan · GMGN · Solscan · GeckoTerminal · pump.fun

### Works on ALL Solana tokens
- pump.fun tokens — full bonding curve, dev wallet, socials
- Major tokens (BONK, RAY, WIF, etc.) — metadata from Jupiter Token API (name, logo, description, socials)
- Any verified Solana SPL token — DexScreener + Helius on-chain data

### 📊 Live Price Strip
Price · 1H% (buys/sells) · 24H% · 5M · Vol 1H · Momentum · auto-refresh

### 📈 Stats Grid — 8 metrics, priority order
MC · Vol 24H · Liquidity · All-Time High MC · Age · Bonded · Holders · Fresh Wallets

### 🕐 Historical Data — From Day 1
- True ATH price + MC (GeckoTerminal OHLCV across top 3 pools, Helius on-chain supply)
- Launch MC, launch price, % change since launch
- All-time cumulative volume, ATH date, days since launch

### 🧠 Token Intel Grid — 3×3, live-updating
| Top 10 H. | Dev H. | Bundled % |
|---|---|---|
| Holders | Fresh W. | LP Status |
| Mint Auth | Freeze Auth | Dex Paid |

### 🔍 Bundle Detection — most accurate available
Multi-layer launch analysis:
- **Paginates up to 4000 signatures** — always reaches the actual creation transaction
- **2-minute launch window** — catches coordinated multi-wave buys (not just 6 seconds)
- **Jito tip detection** — all 8 known tip accounts
- **Same funding wallet** — traces top 20 buyers back to their funding source
- **Same-slot grouping** — 2-slot buckets (~800ms) to catch split bundles
- **Real on-chain supply** — Helius `getTokenSupply` (not hardcoded 1B)
- CLEAN state: full PASS/FAIL checklist

### 🧛 Vamp Coins
Copycat tokens with the same name/symbol — click any to load full analysis

### 👥 Top Holders — Deep Intel
- DEV · 🐋 WHALE · 🆕 FRESH · 👴 VETERAN badges
- Buy/sell history per holder (SOL spent, SOL received, current value)

### 🔴 Rug & Risk Detection
Two live circles — Rug Detection + Market Risk (LOW/MED/HIGH), updates as each scan completes

### 🕵️ Dev History
All previous tokens by this dev — SERIAL RUGGER / MIXED / BUILDER / CLEAN / NEW DEV

### 🔒 Safety Score, 💸 ROI Calculator
Hidden until requested via suggestion pills

### 📖 AI Narrative + Chat
Full live token context (MC, vol, holders, bundles, ATH, dev history) seeded automatically.
Suggestion pills: Safety Score · Quick ROI · Entry strategy · Red flags · Stop loss · Comparable plays

### Socials
Full coverage: Twitter · Telegram · TikTok · Discord · Instagram · YouTube · Reddit · Website

---

## V2 — Coming Soon

| Feature | Status |
|---|---|
| Advanced Mode — KOL/insider detection, sniper tracking, smart money | In development |
| Telegram Bot | In development |
| Discord Bot | In development |
| MoonAi App — mobile, wallet login, push alerts | Planned |

Follow [@Moonai_webApp](https://x.com/Moonai_webApp) for launch updates.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | HTML · CSS · Vanilla JS |
| Font | Lexend |
| AI | Anthropic Claude (claude-sonnet-4-5) — server proxy |
| Market data | DexScreener API · GeckoTerminal OHLCV |
| Token metadata | pump.fun API · Jupiter Token API |
| On-chain | Helius RPC + Enhanced Transactions |
| SOL price | Jupiter Price API |
| Dex paid status | DexScreener Orders API |
| Backend | Vercel Serverless (Node.js) |
| Hosting | Vercel + moonaiapp.xyz |
| Rate limiting | Upstash Redis + in-memory Map fallback |

---

## Security

- All API keys server-side — Vercel env vars, never in browser
- Rate limiting: Redis primary, in-memory fallback (never silently allows all)
- IP via `x-vercel-forwarded-for` (cannot be spoofed)
- Prompt injection stripped before forwarding to Anthropic
- Strict input validation — Solana address regex, symbol regex, timestamp bounds
- CSP + security headers via `vercel.json`

---

## Team

| | Role |
|---|---|
| **itsyaboihomelander** | Frontend · UI/UX · Product |
| **Sorogaia** | Backend · Infrastructure |

---

## License
MIT
