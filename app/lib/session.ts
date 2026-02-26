/**
 * Shared session utilities for API routes.
 * Resolves session cookies from incoming request headers.
 */

/**
 * Extract and normalize the session cookie string from a request.
 * Checks X-Session-Cookie, X-Session-Id, and cookie header (PHPSESSID).
 * Returns null if no session is found.
 */
export function resolveSessionCookie(request: Request): string | null {
  const sessionCookie = request.headers.get("X-Session-Cookie");
  const sessionId =
    request.headers.get("X-Session-Id") ??
    request.headers.get("cookie")?.match(/PHPSESSID=([^;]+)/)?.[1];

  let cookie = sessionCookie?.trim() || null;
  if (!cookie && sessionId) {
    const sid = sessionId.trim();
    cookie =
      sid.includes("%3A") || sid.length > 50
        ? `remember_me=${sid}`
        : `PHPSESSID=${sid}`;
  }
  return cookie;
}

/**
 * Return a 401 JSON Response when session is missing/invalid.
 */
export function unauthorizedResponse(
  message = "Sesi tidak valid. Silakan login lagi."
) {
  return Response.json({ error: message }, { status: 401 });
}
