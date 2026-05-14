# MoonAi — Project Context

## What This Is
A Solana/pump.fun token analyzer. Paste any CA or pump.fun link and get
live on-chain data, AI narrative, safety score, bundle detection, and
holder intel instantly. Free. No signup. No API key.

## Live Links
- Site: https://moonaiapp.xyz
- GitHub: https://github.com/itsyaboihomelander/moonai (canonical: Sorogaia/moonai)
- Branch: master → auto-deploys to Vercel on push

## ⚠️ Source of Truth Files
Edit these — NOT moonai.html (legacy reference only)

| File | Purpose |
|---|---|
| `index.html` | HTML shell, V2 modal, welcome screen, input bar |
| `css/styles.css` | All styles — CSS variables, component classes, responsive |
| `js/app.js` | All frontend logic — render, fetch, chat, refresh |
| `api/chat.js` | Anthropic Claude proxy — rate-limited via Upstash Redis |
| `api/holders.js` | Helius RPC — top 10 token holders |
| `api/bundles.js` | Bundle detection — Jito tip, same funder, same slot |
| `api/token-info.js` | Mint/freeze authority, dev wallet balance |
| `api/fresh-wallets.js` | Fresh wallet % — wallet age vs token launch date |

## Deployment
- Hosted on Vercel (Sorogaia's account)
- Auto-deploys on push to master via GitHub integration
- Manual deploy: `npx vercel --prod` (requires Vercel CLI auth)
- Env vars in Vercel dashboard only — never in code:
  `ANTHROPIC_API_KEY`, `HELIUS_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`

## Two Modes

### Trencher (default — V1 live)
Black + green. Real live data, no AI required to load.
- Token header: image, name, ticker, CA, copy button
- Narrative lore bubble (AI, max 20 words) + ✦ Analysis button
- Safety Score 0–100 (SAFE / CAUTION / WARNING / DANGER)
  - Checks: mint authority, freeze authority, dev sold, dev holdings, liquidity, age, vol/MC ratio
- Price bar: price, 1H, 24H, 5M, Vol 1H, Momentum Score
- Auto-refresh every 60s with live countdown
- Stats row 1: MC · VOL 24H · Liquidity · ATH MC (% down from ATH)
- Stats row 2: Bonded · Dev Wallet · Age · Holders · Fresh Wallets %
- Socials: Twitter, Telegram, Website
- KOLs: V2 placeholder
- Top X Posts: search links (Top Posts / Latest / Dev account)
- Top Holders: real Helius data, DEV + WHALE badges, top 3 + expandable
- Bundle Detection: Jito confirmed / same funder / same slot
  - % bundled, bundle count, wallet count, Jito YES/NO, per-bundle rows, risk verdict
- Trade & Explore: Axiom · Photon · BullX · Trojan · GMGN · Solscan · GeckoTerminal · pump.fun
- AI Chat: full token context seeded, Solana/memecoins topic guard

### Advanced (V2 — locked)
Purple + gold. Toggle shows "Coming Soon" popup. Built but gated.
When unlocked: full AI verdict, holder distribution with role badges
(DEV/INSIDER/KOL/SNIPER/WHALE/COMMUNITY), buyer analysis, risk flags,
alpha narrative write-up.

## APIs Used
| API | Auth | Used for |
|---|---|---|
| DexScreener | none | price, MC, volume, liquidity, pair data |
| pump.fun | none | dev wallet, bonded, socials, description |
| CoinGecko | none | SOL/USD price |
| Anthropic Claude (claude-sonnet-4-5) | server-side only | narrative, analysis, chat |
| Helius RPC | server-side only | top holders, bundle txns, token info, wallet age |
| Upstash Redis | server-side only | rate limiting (20 req/min per IP) |

## Key Rules
- API keys live in Vercel env vars only — never in frontend or git
- Edit index.html + css/styles.css + js/app.js — NOT moonai.html
- Advanced mode stays locked until V2 ships

## V2 Roadmap
- [ ] Advanced mode — unlock with subscription
- [ ] KOL detection — known wallet tagging
- [ ] Top X Posts — full tweet display with views/likes
- [ ] MoonAi App
- [ ] Telegram Bot
- [ ] Discord Bot
- [ ] Subscription model

## Team
- **itsyaboihomelander** — frontend, UI/UX, product (GitHub: itsyaboihomelander)
- **Sorogaia** — backend, infrastructure, Vercel (GitHub: Sorogaia)
