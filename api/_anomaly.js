/**
 * MoonAi — Anomaly detection + auto-suspend for third-party APIs.
 *
 * Flow:
 *  1. check()         — validates a field; calls recordAnomaly() on failure
 *  2. recordAnomaly() — increments Redis counter; auto-suspends + Telegrams at threshold
 *  3. isSuspended()   — checked at start of each handler; returns 503 if suspended
 *
 * Auto-recovery: suspend keys have a TTL (SUSPEND_DURATION). No manual action needed
 * unless the source is still misbehaving after 10 minutes (re-suspends automatically).
 */

const UPSTASH_URL   = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const TG_TOKEN      = process.env.TELEGRAM_BOT_TOKEN;
const TG_CHAT_ID    = process.env.TELEGRAM_CHAT_ID;

const ANOMALY_THRESHOLD = 5;    // failures within window before auto-suspend
const ANOMALY_WINDOW    = 60;   // seconds — rolling window
const SUSPEND_DURATION  = 600;  // seconds — 10 min auto-recovery

// ─────────────────────────────────────────
// Internal Redis helper
// ─────────────────────────────────────────
async function redisPipeline(commands) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return null;
  const res = await fetch(`${UPSTASH_URL}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
  });
  return res.json();
}

async function redisGet(key) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return null;
  const res = await fetch(`${UPSTASH_URL}/get/${key}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
  });
  const data = await res.json();
  return data?.result ?? null;
}

// ─────────────────────────────────────────
// Telegram alert
// ─────────────────────────────────────────
async function sendTelegramAlert(source, field, received, count) {
  if (!TG_TOKEN || !TG_CHAT_ID) return;
  const preview = JSON.stringify(received ?? null).slice(0, 150);
  const text =
    `⚠️ <b>MoonAi — API Anomaly Detected</b>\n\n` +
    `<b>Source:</b> <code>${source}</code>\n` +
    `<b>Field:</b> <code>${field}</code>\n` +
    `<b>Bad value:</b> <code>${preview}</code>\n` +
    `<b>Failures:</b> ${count} in last ${ANOMALY_WINDOW}s\n\n` +
    `🔴 <b>Auto-suspended for 10 minutes.</b>\n` +
    `Site continues operating without <code>${source}</code> data.\n` +
    `Auto-recovers at: ${new Date(Date.now() + SUSPEND_DURATION * 1000).toUTCString()}\n\n` +
    `If urgent, kill all AI calls: Upstash → set <code>moonai:kill</code> = <code>1</code>`;

  await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TG_CHAT_ID, text, parse_mode: 'HTML' }),
  }).catch(() => {});
}

// ─────────────────────────────────────────
// Public API
// ─────────────────────────────────────────

/**
 * Check if an API source is currently auto-suspended.
 * Fails OPEN — if Redis is down, don't block the site.
 * @param {string} source — e.g. 'helius', 'dexscreener', 'pumpfun'
 * @returns {Promise<boolean>} true = suspended (block calls), false = ok
 */
async function isSuspended(source) {
  try {
    const val = await redisGet(`moonai:suspend:${source}`);
    return val === '1';
  } catch {
    return false;
  }
}

/**
 * Record a validation failure for a source.
 * Auto-suspends + sends Telegram alert when ANOMALY_THRESHOLD is reached.
 * Never throws — anomaly tracking must never crash the main request.
 * @param {string} source  — API source name
 * @param {string} field   — field path that failed (e.g. 'result.value[].uiAmount')
 * @param {*}      received — the bad value that was received
 */
async function recordAnomaly(source, field, received) {
  try {
    const countKey   = `moonai:anomaly:${source}`;
    const suspendKey = `moonai:suspend:${source}`;

    const data = await redisPipeline([
      ['INCR',   countKey],
      ['EXPIRE', countKey,   ANOMALY_WINDOW],
      ['GET',    suspendKey],
    ]);

    if (!data) return;

    const count            = data[0]?.result ?? 0;
    const alreadySuspended = data[2]?.result === '1';

    if (count >= ANOMALY_THRESHOLD && !alreadySuspended) {
      await redisPipeline([
        ['SET',    suspendKey, '1'],
        ['EXPIRE', suspendKey, SUSPEND_DURATION],
      ]);
      // Visible in Vercel logs — Functions → Logs
      console.error(`[MOONAI SUSPEND] source=${source} field=${field} failures=${count} value=${JSON.stringify(received ?? null).slice(0, 200)} auto-suspended for ${SUSPEND_DURATION}s`);
      await sendTelegramAlert(source, field, received, count);
    } else if (!alreadySuspended) {
      // Log each individual anomaly for visibility in Vercel logs
      console.warn(`[MOONAI ANOMALY] source=${source} field=${field} failures=${count}/${ANOMALY_THRESHOLD} value=${JSON.stringify(received ?? null).slice(0, 200)}`);
    }
  } catch {
    // Never propagate — anomaly tracking is best-effort
  }
}

/**
 * Validate a condition about a field in a third-party API response.
 * If the condition is false, records an anomaly and returns false.
 * The caller should use a safe default when this returns false.
 *
 * @param {string}  source    — API source name
 * @param {boolean} condition — true = valid, false = anomalous
 * @param {string}  field     — field path being validated
 * @param {*}       received  — the actual value (for alert context)
 * @returns {Promise<boolean>} true = valid, false = anomalous
 */
async function check(source, condition, field, received) {
  if (condition) return true;
  await recordAnomaly(source, field, received);
  return false;
}

module.exports = { isSuspended, recordAnomaly, check };
