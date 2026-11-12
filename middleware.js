// Vercel Routing Middleware: puts the whole site behind HTTP Basic Auth.
// Set SITE_PASSWORD in the Vercel project's Environment Variables. Any username works.

export const config = { matcher: "/:path*" };

export default function middleware(request) {
  const password = (process.env.SITE_PASSWORD || "").trim();
  if (!password) {
    return new Response("SITE_PASSWORD is not set on this deployment.", { status: 500 });
  }

  const header = request.headers.get("authorization") || "";
  if (header.startsWith("Basic ")) {
    try {
      // Decode as UTF-8 so accented characters in the password work.
      const bytes = Uint8Array.from(atob(header.slice(6)), (c) => c.charCodeAt(0));
      const decoded = new TextDecoder().decode(bytes);
      const given = decoded.slice(decoded.indexOf(":") + 1).trim();
      if (safeEqual(given, password)) {
        // Let the request through to the static files.
        return new Response(null, { headers: { "x-middleware-next": "1" } });
      }
      console.log(`auth failed: typed ${given.length} chars, expected ${password.length}`);
    } catch {
      // malformed header: fall through to the challenge
    }
  }

  return new Response("Password required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Travelling Inn", charset="UTF-8"' },
  });
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
