# MoonAi — Project Context

## What This Is
A Solana/pump.fun token analyzer with an AI chatbot, powered by a Vercel backend proxy.

## ⚠️ Source of Truth Files (edit these, NOT moonai.html)
- `index.html` — HTML structure only
- `css/styles.css` — all styles
- `js/app.js` — all JavaScript logic
- `api/chat.js` — Vercel serverless function: proxies Anthropic API, rate-limited via Upstash Redis
- `api/holders.js` — Vercel serverless function: proxies Helius RPC for top holder data
- `moonai.html` — legacy single file, kept for reference only (mirrors js/app.js logic)

## Live Links
- GitHub: https://github.com/itsyaboihomelander/moonai
- Live site: https://moonaiapp.xyz

## Git Setup
- Remote: origin → https://github.com/itsyaboihomelander/moonai.git
- Branch: master

## Deployment
- Hosted on Vercel (not GitHub Pages)
- Deploy: `npx vercel --prod` from project root
- Env vars set in Vercel dashboard (never in code): ANTHROPIC_API_KEY, HELIUS_API_KEY, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN

## Two Modes
1. **Trencher** (default) — black/green, real live data cards
2. **Advanced** — midnight purple/gold, full AI analysis with role badges, snipers, etc.

## APIs Currently Used
- DexScreener — free, no key (MC, VOL, liquidity, price)
- pump.fun — free, no key (dev wallet, bonded, socials, holders)
- CoinGecko — free, no key (SOL price)
- Anthropic Claude — server-side via `/api/chat` (key never in browser)
- Helius RPC — server-side via `/api/holders` (top 10 token holders)
- Upstash Redis — rate limiting on `/api/chat` (20 req/min per IP)

## What's Built
- [x] Trencher mode — live data cards (DexScreener + pump.fun)
- [x] Advanced mode — full AI analysis, ticker, hourly %, snipers panel
- [x] Topic guard — Solana/memecoins only (client-side + system prompt)
- [x] Vercel backend proxy — Anthropic key hidden server-side
- [x] Top Holders — real Helius data, DEV badge, % concentration
- [x] Rate limiting — Upstash Redis, 20 req/min per IP
- [x] Mode toggle — iOS-style switch, saves preference

## What's Next (Priority Order)
1. **Bundle detection** — collaborator is building this, goes in Advanced mode
2. **KOL detection** — known influencer wallet tagging in Top Holders
3. **Advanced+ mode** — TBD feature
4. **Subscription model** — when traffic grows

## Key Decisions Made
- All API keys owned by site owner, stored only in Vercel env vars
- Keys never in frontend code or localStorage
- Helius free tier is enough for holder data
- Bundle detection handled separately by a collaborator

## Owner
- GitHub: itsyaboihomelander
- Git name: itsyaboihomelander
- Git email: itsyaboihomelander@proton.me
