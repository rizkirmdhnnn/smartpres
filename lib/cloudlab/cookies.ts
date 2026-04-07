/**
 * Extracts the session cookie string from incoming request headers.
 *
 * Priority: X-Session-Cookie > X-Session-Id > cookie header PHPSESSID.
 * Returns `null` if no session info is found.
 */
export function extractSessionCookie(request: Request): string | null {
  const sessionCookie = request.headers.get("X-Session-Cookie");
  if (sessionCookie?.trim()) return sessionCookie.trim();

  const sessionId =
    request.headers.get("X-Session-Id") ??
    request.headers.get("cookie")?.match(/PHPSESSID=([^;]+)/)?.[1];

  if (!sessionId) return null;

  const sid = sessionId.trim();
  if (sid.includes("%3A") || sid.length > 50) {
    return `remember_me=${sid}`;
  }
  return `PHPSESSID=${sid}`;
}

/**
 * Extracts Set-Cookie values from a fetch Response, handling both
 * modern `getSetCookie()` and the fallback single-header approach.
 */
export function getSetCookieHeaders(response: Response): string[] {
  type HeadersWithGetSetCookie = Headers & { getSetCookie?: () => string[] };
  const headers = response.headers as HeadersWithGetSetCookie;

  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }

  const single = response.headers.get("set-cookie");
  return single ? [single] : [];
}

/**
 * Collects cookies from a Response's Set-Cookie headers into a mutable
 * cookie-parts array. Existing cookies with the same name are updated.
 */
export function collectCookies(
  response: Response,
  parts: string[]
): void {
  for (const setCookie of getSetCookieHeaders(response)) {
    const match = setCookie.match(/^([^=]+)=([^;]+)/);
    if (!match) continue;

    const name = match[1].trim();
    const value = match[2].trim();
    const idx = parts.findIndex((p) => p.startsWith(`${name}=`));

    if (idx >= 0) {
      parts[idx] = `${name}=${value}`;
    } else {
      parts.push(`${name}=${value}`);
    }
  }
}

/**
 * Reads a specific cookie value from the cookie-parts array.
 */
export function getCookieValue(
  parts: string[],
  name: string
): string | null {
  const entry = parts.find((p) => p.startsWith(`${name}=`));
  return entry ? entry.slice(name.length + 1) : null;
}
