// Site-wide password gate (HTTP Basic Auth).
// Runs on every request — pages and /api/* routes — before anything else.
//
// Password resolution order:
//   1. SITE_PASSWORD env var (set in the Vercel dashboard — preferred)
//   2. fallback default below, so the gate works immediately on deploy
//
// To change the password without redeploying, set SITE_PASSWORD in Vercel.
// Username is ignored — visitors can type anything in the username field.

export const config = {
  // Apply to all routes.
  matcher: '/:path*',
};

export default function middleware(request) {
  const PASSWORD = process.env.SITE_PASSWORD || 'adminaccess123';

  const header = request.headers.get('authorization') || '';

  if (header.startsWith('Basic ')) {
    try {
      const decoded = atob(header.slice(6));
      const sep = decoded.indexOf(':');
      const supplied = sep === -1 ? decoded : decoded.slice(sep + 1);
      if (timingSafeEqual(supplied, PASSWORD)) {
        return; // authenticated — continue to the requested resource
      }
    } catch {
      // malformed header — fall through to the 401 prompt
    }
  }

  return new Response('Authentication required.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="MoonAi — restricted access", charset="UTF-8"',
      'Content-Type': 'text/plain',
      'Cache-Control': 'no-store',
    },
  });
}

// Length-independent comparison to avoid leaking the password via timing.
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
