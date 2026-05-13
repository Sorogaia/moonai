# API Reference

MoonAi uses three external APIs. Two are completely free with no key required.

---

## DexScreener API
**Free — no key required**

Used for: MC, price, volume, liquidity, 1H/24H price changes, buys/sells, pair URL, token image, socials.

```
GET https://api.dexscreener.com/latest/dex/tokens/{CA}
```

---

## pump.fun API
**Free — no key required**

Used for: token name, symbol, description, image, dev wallet, bonded status, Twitter, Telegram, website, supply, holder count.

```
GET https://frontend-api.pump.fun/coins/{CA}
```

---

## Anthropic Claude API
**Requires key — pay per use**

Used for: narrative lore bubble, deep narrative analysis, AI follow-up chat.

Model: `claude-sonnet-4-5`

Get your key at [console.anthropic.com](https://console.anthropic.com).

Typical cost per analysis: ~$0.003

---

## CoinGecko API
**Free — no key required**

Used for: live SOL price (for liquidity fallback on bonding curve tokens).

```
GET https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd
```
