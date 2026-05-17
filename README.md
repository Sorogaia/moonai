# 🌙 MoonAi

> Solana token intelligence. Built for degens.

Paste any Solana CA or pump.fun link. Get real on-chain data, AI analysis, bundle detection, holder intel, rug/risk scoring, and trading alpha — instantly. Free. No signup. No key required.

**Live → [moonaiapp.xyz](https://moonaiapp.xyz)**
**Twitter → [@Moonai_webApp](https://x.com/Moonai_webApp)**

---

## Features — V1 Live Now

### Token Overview
- Token image, name, ticker, full CA + one-click copy
- LIVE badge, age, DexScreener link, holders count
- Trade links: Axiom · Photon · BullX · Trojan · GMGN · Solscan · GeckoTerminal · pump.fun

### 📊 Live Price Strip
Price · 1H% (buys/sells) · 24H% (buys/sells) · 5M · Vol 1H · Momentum · auto-refresh countdown

### 📈 Stats Grid (8 metrics, priority order)
MC · Vol 24H · Liquidity · All-Time High MC · Age · Bonded · Holders · Fresh Wallets

### 🕐 Historical Data — From Day 1
Real ATH price + MC (GeckoTerminal OHLCV, top-3 pool scan, Helius on-chain supply)
- True ATH MC with % down from ATH
- Launch MC, launch price, % change since launch
- All-time cumulative volume, ATH date, days since launch

### 🧠 Token Intel Grid (3×3, live-updating)
All values update as async scans complete:

| Top 10 H. | Dev H. | Bundled % |
|---|---|---|
| Holders | Fresh W. | LP Status |
| Mint Auth | Freeze Auth | Dex Paid |

### 🔍 Bundle Detection
Multi-layer launch analysis — side by side with Vamp Coins:
- Jito tip confirmation · Same funding wallet · Same-slot sniping
- Per-bundle rows with wallet list and % of supply
- LOW / MEDIUM / HIGH risk verdict
- CLEAN state: full PASS/FAIL checklist

### 🧛 Vamp Coins
Copycat tokens with the same name/symbol:
- Image, name, VAMP badge, MC, 24h%, copy CA
- Click any vamp → loads full analysis

### 👥 Top Holders — Deep Intel
Buy/sell history per holder via Helius Enhanced Transactions:
- DEV · 🐋 WHALE · 🆕 FRESH · 👴 VETERAN badges
- Tokens bought + SOL spent (USD value)
- Sold amount + SOL received back — no confusing % of position
- Current holding USD value at live MC
- Top 3 shown + expandable

### 🔴 Rug & Risk Detection Strip
Two live-updating circles at the bottom:
- **Rug Detection**: mint auth, freeze auth, dev sold, Jito, dev bundled → LOW/MED/HIGH
- **Market Risk**: top holder %, fresh wallets %, bundle % → LOW/MED/HIGH

### 🕵️ Dev History
All previous tokens launched by this dev wallet:
- Stats: total / alive / bonded / dead
- Reputation badge: SERIAL RUGGER / MIXED / BUILDER / CLEAN / NEW DEV

### 🔒 Safety Score (0–100)
Hidden until requested via suggestion pill — SAFE / CAUTION / WARNING / DANGER

### 💸 ROI Calculator
Hidden until requested — $100 at 2x/5x/10x/50x/100x with MC targets

### 📖 AI Narrative + Chat
Full live token context seeded (MC, vol, holders, bundles, ATH, dev history, etc.).
Ask anything about the token — Solana/memecoins only.
Suggestion pills: Safety Score · Quick ROI · Entry strategy · Red flags · Stop loss · Comparable plays

### Socials
Twitter · Telegram · TikTok · Discord · Instagram · YouTube · Reddit · Website — whatever the token has

---

## V2 — Coming Soon

| Feature | Status |
|---|---|
| Advanced Mode (full AI verdict, KOL/insider detection, sniper tracking, smart money) | In development |
| Telegram Bot — scan tokens in any TG group | In development |
| Discord Bot — MoonAi inside your server | In development |
| MoonAi App — mobile, wallet login, push alerts | Planned |

Follow [@Moonai_webApp](https://x.com/Moonai_webApp) for launch updates.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | HTML · CSS · Vanilla JS (no framework) |
| Font | Lexend (Google Fonts) |
| AI | Anthropic Claude (claude-sonnet-4-5) — server-side proxy |
| Market data | DexScreener API · GeckoTerminal API |
| Token metadata | pump.fun API |
| On-chain data | Helius RPC + Enhanced Transactions API |
| SOL price | Jupiter Price API |
| Historical data | GeckoTerminal OHLCV + Helius getTokenSupply |
| Dex paid status | DexScreener Orders API |
| Backend | Vercel Serverless Functions (Node.js) |
| Hosting | Vercel + moonaiapp.xyz |
| Rate limiting | Upstash Redis + in-memory Map fallback |

---

## Security

- All API keys server-side only — Vercel env vars, never in browser
- Rate limiting on every endpoint — Redis primary, in-memory fallback
- IP extraction via `x-vercel-forwarded-for` (cannot be spoofed by client)
- Prompt injection sanitised in chat proxy before forwarding to Anthropic
- Strict input validation — Solana address regex, symbol alphanumeric regex, timestamp bounds
- Content-Security-Policy, X-Frame-Options, X-Content-Type-Options headers enforced via `vercel.json`

---

## Team

| | Role |
|---|---|
| **itsyaboihomelander** | Frontend · UI/UX · Product |
| **Sorogaia** | Backend · Infrastructure |

---

## License

MIT
