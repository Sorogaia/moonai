# Setup Guide

## Using MoonAi

No API key needed. No signup. No install.

1. Go to [moonaiapp.xyz](https://moonaiapp.xyz)
2. Paste any Solana CA or pump.fun link
3. Done

---

## Running Locally

Clone the repo and open `index.html` in any browser:

```bash
git clone https://github.com/Sorogaia/moonai.git
cd moonai
```

Open `index.html` directly, or with live reload:
```bash
npx live-server .
```

> **Note:** When running locally, AI chat and holder data won't work without the backend. See **Backend Setup** below.

---

## Backend Setup (Vercel)

The backend proxies Anthropic and Helius so API keys are never in the browser.

### 1. Install Vercel CLI
```bash
npm install -g vercel
```

### 2. Set environment variables in Vercel dashboard
```
ANTHROPIC_API_KEY      = your Anthropic key
HELIUS_API_KEY         = your Helius key
UPSTASH_REDIS_REST_URL = your Upstash Redis URL
UPSTASH_REDIS_REST_TOKEN = your Upstash token
```

### 3. Deploy
```bash
vercel --prod
```

### API Endpoints
- `POST /api/chat` — proxies Anthropic API, rate-limited (20 req/min per IP)
- `GET /api/holders?ca={CA}` — fetches top 10 holders via Helius RPC

---

## Getting API Keys

| Service | Where | Cost |
|---|---|---|
| Anthropic | [console.anthropic.com](https://console.anthropic.com) | ~$0.003/analysis |
| Helius | [helius.dev](https://helius.dev) | Free tier available |
| Upstash Redis | [upstash.com](https://upstash.com) | Free tier available |
