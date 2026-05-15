/**
 * Shared rate limiting for MoonAi API endpoints via Upstash Redis.
 * Underscore prefix = not exposed as a Vercel route.
 */

const UPSTASH_URL   = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

/**
 * @param {string} ip
 * @param {object} opts
 * @param {number} opts.limit  - max requests per window (default 60)
 * @param {number} opts.window - window in seconds (default 60)
 * @param {string} opts.prefix - key prefix (default 'api')
 * @returns {Promise<boolean>} true = allowed, false = rate limited
 */
async function checkRateLimit(ip, { limit = 60, window = 60, prefix = 'api' } = {}) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return true; // allow if Redis not configured
  const key = `moonai:${prefix}:${ip}`;
  try {
    const res = await fetch(`${UPSTASH_URL}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([['INCR', key], ['EXPIRE', key, window]]),
    });
    const data = await res.json();
    return (data?.[0]?.result ?? 0) <= limit;
  } catch {
    return true; // allow on Redis error — don't block users for infra issues
  }
}

module.exports = { checkRateLimit };
