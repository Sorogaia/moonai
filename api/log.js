const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://moonaiapp.xyz';

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).end();

  // sendBeacon sends raw string body; fetch sends parsed JSON
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = { raw: body }; }
  }

  const { event, data } = body || {};
  console.log(`[FRONTEND] ${event || 'unknown'}:`, JSON.stringify(data ?? {}));
  return res.status(200).end();
};
