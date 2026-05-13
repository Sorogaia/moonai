# API Reference

MoonAi uses secured backend proxies — no keys are ever exposed in the browser.

---

## Backend Endpoints

### POST /api/chat
Proxies AI analysis server-side. Rate limited per IP.

---

### GET /api/holders?ca={CA}
Returns top holder data for a token.

---

### GET /api/token-info?ca={CA}&dev={DEV_WALLET}
Returns token authority status and dev wallet activity.

---

### GET /api/bundles?ca={CA}&dev={DEV_WALLET}
Returns bundle risk analysis for a token launch.

---

### GET /api/fresh-wallets?ca={CA}
Returns fresh wallet concentration data.

---

## Public APIs (Free, No Key Required)

| API | Used For |
|---|---|
| DexScreener | Price, MC, volume, liquidity |
| pump.fun | Token metadata, socials, dev wallet |
| CoinGecko | SOL price |
