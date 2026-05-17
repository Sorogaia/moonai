/**
 * Shared rate limiting for MoonAi API endpoints.
 * Primary:  Upstash Redis (distributed, survives cold starts)
 * Fallback: In-process Map (single-instance, resets on cold start)
 *           — prevents unlimited requests if Redis is misconfigured.
 */

const UPSTASH_URL   = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// In-memory fallback store: key → { count, resetAt }
const _memStore = new Map();
const MEM_CLEANUP_INTERVAL = 60_000;
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of _memStore) {
    if (now >= v.resetAt) _memStore.delete(k);
  }
}, MEM_CLEANUP_INTERVAL).unref?.(); // .unref() so it doesn't keep the process alive

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

/**
 * @param {string} ip
 * @param {object} opts
 * @param {number} opts.limit  - max requests per window (default 60)
 * @param {number} opts.window - window in seconds (default 60)
 * @param {string} opts.prefix - key prefix (default 'api')
 * @returns {Promise<boolean>} true = allowed, false = rate limited
 */
async function checkRateLimit(ip, { limit = 60, window = 60, prefix = 'api' } = {}) {
  // Try Redis first
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    try {
      const key = `moonai:${prefix}:${ip}`;
      const res = await fetch(`${UPSTASH_URL}/pipeline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${UPSTASH_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([['INCR', key], ['EXPIRE', key, window]]),
      });
      if (res.ok) {
        const data = await res.json();
        return (data?.[0]?.result ?? 0) <= limit;
      }
    } catch { /* fall through to in-memory */ }
  }

  // Fallback: in-memory rate limit (less precise across instances but better than nothing)
  return memRateLimit(ip, prefix, limit, window);
}

module.exports = { checkRateLimit };
