# MoonAi — Contributor Guide

## What This Is
A real-time Solana & pump.fun token analyzer. Paste any CA or pump.fun link
and get live market data, AI narrative, safety score, bundle detection,
holder intel, rug/risk detection, and trading tools — instantly. Free. No signup.

## Live Site
https://moonaiapp.xyz

## Source of Truth Files
| File | Purpose |
|---|---|
| `index.html` | HTML shell — structure, V2 modal, welcome screen |
| `css/styles.css` | All styles — never write inline styles in JS |
| `js/app.js` | All frontend logic — data fetching, rendering, AI chat |
| `api/*.js` | Vercel serverless functions — backend proxies & business logic |
| `vercel.json` | Deployment config, security headers, function timeouts |

> **Do not edit `moonai.html`** — legacy reference, excluded from repo.

## Running Locally
```bash
git clone https://github.com/itsyaboihomelander/moonai.git
cd moonai
npx live-server .
```
API features (AI chat, holders, bundles, etc.) require the Vercel backend.
For local API testing, use `npx vercel dev`.

## Deployment
Hosted on Vercel. Connected to GitHub — push to `master` → auto-deploy.
Manual deploy: `npx vercel --prod` (requires `npx vercel login` first)

## Environment Variables
**Never commit real values.** Set in Vercel dashboard → Project Settings → Environment Variables.
See `.env.example` for the full list of required variables.

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Claude AI for chat responses |
| `HELIUS_API_KEY` | Solana RPC + enhanced tx data |
| `UPSTASH_REDIS_REST_URL` | Rate limiting (Upstash Redis) |
| `UPSTASH_REDIS_REST_TOKEN` | Rate limiting auth |

## API Endpoints
| Endpoint | Purpose | Rate Limit |
|---|---|---|
| `POST /api/chat` | AI chat proxy (Anthropic) | 20/min |
| `GET /api/holders` | Top 10 holder analysis | 30/min |
| `GET /api/bundles` | Bundle/sniper detection | 30/min |
| `GET /api/token-info` | Mint/freeze auth + dev holdings | 60/min |
| `GET /api/token-history` | ATH, launch price, all-time vol | 30/min |
| `GET /api/fresh-wallets` | Fresh wallet % at launch | 60/min |
| `GET /api/vamps` | Similar token scanner | 30/min |
| `GET /api/dev-history` | Dev wallet transaction history | 20/min |

## Security Notes
- All API keys live in env vars only — never in code
- Rate limiting: Upstash Redis primary, in-memory Map fallback
- IP extraction uses `x-vercel-forwarded-for` (cannot be spoofed)
- Prompt injection sanitised in `chat.js` before forwarding to Anthropic
- CSP headers set in `vercel.json`

## Team
- **itsyaboihomelander** — frontend, UI/UX, product
- **Sorogaia** — backend, infrastructure
