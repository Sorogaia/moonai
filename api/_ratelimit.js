/**
 * Shared rate limiting for MoonAi API endpoints.
 *
 * Three layers (all backed by Upstash Redis):
 *  1. checkRateLimit    — per-minute sliding window (existing, all endpoints)
 *  2. checkDailyLimit   — per-IP daily cap (AI endpoints only)
 *  3. checkGlobalDaily  — global daily cap across all users (AI endpoints only)
 *  4. checkKillSwitch   — emergency hard stop, flipped manually in Upstash
 *
 * Primary:  Upstash Redis (distributed, survives cold starts)
 * Fallback: In-process Map for per-minute + per-IP daily
 *           Global daily + kill switch require Redis — fail open if unavailable.
 */

const UPSTASH_URL   = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// Daily limits for AI (chat) endpoint — both tunable from the Vercel dashboard
// (no redeploy) so caps can be raised instantly under launch-day load.
const DAILY_PER_IP     = parseInt(process.env.DAILY_PER_IP_CAP)  || 100;    // max AI requests per IP per day
const DAILY_GLOBAL     = parseInt(process.env.DAILY_GLOBAL_CAP)  || 10000;  // max AI requests across ALL users per day (~$30-50 worst case)
const KILL_SWITCH_KEY  = 'moonai:kill';

// In-memory fallback store: key → { count, resetAt }
const _memStore = new Map();
const MEM_CLEANUP_INTERVAL = 60_000;
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of _memStore) {
    if (now >= v.resetAt) _memStore.delete(k);
  }
}, MEM_CLEANUP_INTERVAL).unref?.();

function memRateLimit(ip, prefix, limit, window) {
  const key = `moonai:${prefix}:${ip}`;
  const now = Date.now();
  const entry = _memStore.get(key);
  if (!entry || now >= entry.resetAt) {
    _memStore.set(key, { count: 1, resetAt: now + window * 1000 });
    return true;
  }
  entry.count++;
  return entry.count <= limit;
}

// UTC date string used to namespace daily keys — auto-resets at midnight UTC
function utcDate() {
  return new Date().toISOString().slice(0, 10); // e.g. "2026-05-19"
}

async function redisPost(body) {
  const res = await fetch(`${UPSTASH_URL}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Upstash ${res.status}`);
  return res.json();
}

/**
 * Per-minute sliding window rate limit (all endpoints).
 * @returns {Promise<boolean>} true = allowed
 */
async function checkRateLimit(ip, { limit = 60, window = 60, prefix = 'api' } = {}) {
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    try {
      const key  = `moonai:${prefix}:${ip}`;
      const data = await redisPost([['INCR', key], ['EXPIRE', key, window]]);
      return (data?.[0]?.result ?? 0) <= limit;
    } catch { /* fall through */ }
  }
  return memRateLimit(ip, prefix, limit, window);
}

/**
 * Per-IP daily cap — resets at midnight UTC.
 * Falls back to in-memory if Redis unavailable.
 * @returns {Promise<boolean>} true = allowed
 */
async function checkDailyLimit(ip, prefix = 'chat') {
  const key = `moonai:daily:${prefix}:${ip}:${utcDate()}`;

  if (UPSTASH_URL && UPSTASH_TOKEN) {
    try {
      const data = await redisPost([['INCR', key], ['EXPIRE', key, 86400]]);
      return (data?.[0]?.result ?? 0) <= DAILY_PER_IP;
    } catch { /* fall through */ }
  }
  // In-memory fallback — less accurate across instances but better than nothing
  return memRateLimit(ip, `daily:${prefix}`, DAILY_PER_IP, 86400);
}

/**
 * Global daily cap across all users — requires Redis.
 * Fails OPEN if Redis unavailable (avoids locking out all users on Redis downtime).
 * @returns {Promise<boolean>} true = allowed
 */
async function checkGlobalDaily(prefix = 'chat') {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return true; // fail open
  const key = `moonai:daily:global:${prefix}:${utcDate()}`;
  try {
    const data = await redisPost([['INCR', key], ['EXPIRE', key, 86400]]);
    return (data?.[0]?.result ?? 0) <= DAILY_GLOBAL;
  } catch {
    return true; // fail open — don't block all users on Redis hiccup
  }
}

/**
 * Kill switch — set key "moonai:kill" to "1" in Upstash to block all AI calls.
 * Delete the key or set it to "0" to re-enable.
 * Fails OPEN if Redis unavailable (avoids accidental lockout).
 * @returns {Promise<boolean>} true = kill switch is OFF (allow), false = kill switch is ON (block)
 */
async function checkKillSwitch() {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return true; // fail open
  try {
    const res = await fetch(`${UPSTASH_URL}/get/${KILL_SWITCH_KEY}`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
    });
    const data = await res.json();
    return data?.result !== '1'; // true = allow, false = blocked
  } catch {
    return true; // fail open
  }
}

module.exports = { checkRateLimit, checkDailyLimit, checkGlobalDaily, checkKillSwitch };
