# API Reference

MoonAi uses secured backend proxies — no API keys are ever exposed to the browser.
All endpoints enforce: CORS to `ALLOWED_ORIGIN`, per-IP rate limiting, and
strict input validation.

---

## Endpoints

### `POST /api/chat`
Streaming AI chat proxy (Anthropic Claude Sonnet 4.5).
- Body: `{ model, max_tokens, system, messages, turnstileToken }`
- Rate limit: 20/min/IP, 100/day/IP, 1000/day global
- Returns: SSE stream of Anthropic events on success; JSON on error
- Protection: Turnstile bot verification, prompt-injection scrubbing, kill switch

### `POST /api/lore`
Fast one-line factual narrative (Anthropic Haiku 4.5, no Turnstile).
- Body: `{ name, symbol, description, ch24 }` — all length-capped server-side
- Rate limit: 30/min/IP, shares chat daily cap
- Server-controlled prompt; no client-side injection vector

### `GET /api/trending`
Live trenches snapshot — fed into chat context.
- Returns: `{ topMC, fresh, boosts, ts }`
- Sources: pump.fun top by MC, pump.fun just-launched, DexScreener boosted
- Cached 60s in-process per Vercel instance

### `GET /api/holders?ca={CA}`
Top 10 holders + per-wallet buy/sell history.
- Sources: Helius `getTokenLargestAccounts` + Enhanced Transactions API
- Returns: holders array, real total holder count, supply

### `GET /api/bundles?ca={CA}&dev={DEV_WALLET}`
Launch bundle / sniper detection.
- Paginates up to 4000 signatures back to creation
- Detects: Jito atomic bundles, same-funder groups, slot-bucket coordination
- Thresholds (configurable at top of `bundles.js`):
  - SLOT bundles: ≥3 wallets in 4-slot window, ≥0.5% supply
  - FUNDED bundles: ≥2 wallets, ≥0.5% supply
  - JITO bundles: ≥1 wallet, ≥0.3% supply
- Returns: bundle list + still-holding % + dev-bundled flag

### `GET /api/token-info?ca={CA}&dev={DEV_WALLET}`
Mint/freeze authority + dev wallet holdings.
- Two-phase: mint info + supply, then dev account lookup
- Auto-falls back to mintAuthority if no `dev` param

### `GET /api/token-history?ca={CA}&pair={PAIR}`
Real all-time-high + launch data.
- Sorts pools two ways: by `pool_created_at` (oldest = launch) and by volume (top = current)
- Scans top 3 + oldest pool with HOUR candles, falls back to DAY for >41-day-old tokens
- Catches pre-migration ATHs on pumpswap/Raydium-graduated tokens

### `GET /api/fresh-wallets?ca={CA}&created={TS}`
Fresh wallet concentration among top holders.

### `GET /api/vamps?ca={CA}&symbol={SYM}`
Copycat token scanner.
- Strict matching: exact symbol, version variants (BONK2, BONKv2), short prefix, or name word-boundary match
- $5K MC floor, deduped by base CA, ranked by 24h volume

### `GET /api/dev-history?dev={WALLET}`
All previous tokens by a dev wallet.

### `GET /api/dex-paid?ca={CA}`
DexScreener "paid profile" detection.
- Dual signal: orders endpoint + pair `info.header`/`info.openGraph`
- Returns: `{ paid, type }` where type is `takeover` / `boosted` / `profile`

---

## Public APIs Used (Free, No Key Required)

| API | Used For |
|---|---|
| DexScreener | Price, MC, volume, liquidity, paid status, boosts |
| GeckoTerminal | OHLCV candles for ATH + launch data |
| pump.fun frontend API | Token metadata, dev wallet, bonding curve, trending |
| Jupiter Token API | Verified metadata for major SPL tokens |
| CoinGecko | SOL price |
| Rugcheck.xyz | Third-party rug risk score |

---

## Security Posture (Summary)

- All API keys server-side only (Vercel env vars)
- CORS locked to `ALLOWED_ORIGIN`
- Rate limiting: Upstash Redis primary, in-memory fallback (never silently open)
- IP via `x-vercel-forwarded-for` (Vercel-set, unspoofable)
- Prompt injection regex scrubs both client-supplied context and user messages
- Cloudflare Turnstile invisible bot verification on `/api/chat`
- CSP + standard security headers via `vercel.json`
- All external data HTML-escaped before DOM insertion
- Solana address validation via base58 regex in `_validate.js`
