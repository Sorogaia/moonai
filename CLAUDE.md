# MoonAi — Contributor Guide

## What This Is
A real-time Solana & pump.fun token analyzer. Paste any CA or pump.fun link
and get live market data, AI narrative, safety score, bundle detection,
holder intel, and trading tools — instantly. Free. No signup.

## Live Site
https://moonaiapp.xyz

## Source of Truth Files
| File | Purpose |
|---|---|
| `index.html` | HTML shell only — structure, modal, welcome screen |
| `css/styles.css` | All styles — edit here, not inline |
| `js/app.js` | All frontend logic |
| `api/*.js` | Vercel serverless functions — backend proxies |

> **Do not edit `moonai.html`** — legacy reference, excluded from repo.

## Running Locally
```bash
git clone https://github.com/itsyaboihomelander/moonai.git
cd moonai
npx live-server .
```
API features (AI, holders, bundles) require the Vercel backend.

## Deployment
Hosted on Vercel. Push to `master` → auto-deploys.
Manual: `npx vercel --prod`

## Environment Variables
Set in the Vercel dashboard only. Never commit these:
- `ANTHROPIC_API_KEY`
- `HELIUS_API_KEY`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

## Contributing
See [CONTRIBUTING.md](CONTRIBUTING.md).

## Team
- **itsyaboihomelander** — frontend, UI/UX, product
- **Sorogaia** — backend, infrastructure
