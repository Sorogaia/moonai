# Contributing to MoonAi

Thanks for your interest in contributing.

---

## Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/itsyaboihomelander/moonai.git
   cd moonai
   ```
3. Install nothing — no build tools required
4. Run locally:
   ```bash
   npx live-server .
   ```
5. For API features (AI chat, holders, bundles, etc.):
   ```bash
   cp .env.example .env.local   # fill in your keys
   npx vercel dev
   ```

---

## Project Structure

```
moonai/
├── index.html          # HTML shell only — structure, modals, welcome
├── css/styles.css      # All styles — edit here, never inline in JS
├── js/app.js           # All frontend logic
├── api/
│   ├── _validate.js     # Shared validation (not a public route)
│   ├── _ratelimit.js    # Redis + in-memory rate limiting (not a public route)
│   ├── _anomaly.js      # Upstream-API health watchdog + Telegram alerts (not a public route)
│   ├── chat.js          # AI chat proxy (Anthropic, streaming SSE)
│   ├── lore.js          # Fast one-line narrative (Anthropic Haiku, no Turnstile)
│   ├── trending.js      # Live trenches feed (pump.fun top + DexScreener boosts)
│   ├── holders.js       # Top holder analysis (Helius)
│   ├── bundles.js       # Bundle/sniper detection (Helius)
│   ├── token-info.js    # Mint/freeze/dev holdings (Helius RPC)
│   ├── token-history.js # Real ATH + launch data (GeckoTerminal, multi-pool scan)
│   ├── fresh-wallets.js # Fresh wallet detection (Helius)
│   ├── vamps.js         # Copycat token scanner (DexScreener)
│   ├── dev-history.js   # Dev wallet history (pump.fun)
│   ├── dex-paid.js      # DexScreener "paid profile" detection (orders + info signals)
│   └── beta-gate.js     # Optional beta access gate (HMAC-tokenised 48h sessions)
├── vercel.json         # Deployment config + security headers
└── .env.example        # Required env vars (no real values)
```

---

## Rules

- **Never hardcode API keys** — use env vars only
- **Never write inline styles in JS** — add classes to `css/styles.css`
- **No npm dependencies** — keep it zero-dependency on the frontend
- **Match the existing code style** — ES2020+, async/await, template literals
- **Test on desktop and mobile** before submitting

---

## What We're Looking For

- Bug fixes
- UI/UX improvements (especially reducing scroll, improving clarity)
- New trading platform integrations in the trade links row
- Performance improvements (faster async, smarter caching)
- Better mobile layout

## What to Avoid

- Breaking changes to the `_liveData` global object (AI chat depends on it)
- Adding external JS libraries
- Changing the Vercel function structure without discussion

---

## Submitting Changes

1. Create a branch: `git checkout -b feat/your-feature`
2. Make your changes
3. Test locally with `npx vercel dev`
4. Push and open a PR against `master`

---

## Reporting Bugs

Open a GitHub Issue with:
- Steps to reproduce
- Expected behaviour
- Actual behaviour
- Browser, OS, screen size
- CA you were analyzing (if relevant)

---

## Contact

GitHub Issues or [@Moonai_webApp](https://x.com/Moonai_webApp) on Twitter
