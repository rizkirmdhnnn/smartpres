/**
 * Shared CloudLab utilities — constants, helpers, and common detection logic.
 */

export const CLOUDLAB_BASE = "https://cloudlab.amikom.ac.id";

/** Standard browser-like headers used for all CloudLab requests. */
export const BROWSER_HEADERS: Record<string, string> = {
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

/** Strip all HTML tags and collapse whitespace. */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Detect whether an HTML response body is actually the CloudLab login page.
 * This happens when a session has expired — CloudLab returns 200 with the login form.
 */
export function isCloudLabLoginPage(html: string): boolean {
  return (
    html.includes("Login - Presensi QR") ||
    html.includes("Email atau password salah!") ||
    (html.includes("Masukkan email") &&
      html.includes("Masukkan password") &&
      html.includes('name="password"'))
  );
}

/**
 * Check whether a redirect response points to the login page (session expired).
 */
export function isRedirectToLogin(res: Response): boolean {
  if (res.status !== 301 && res.status !== 302) return false;
  const location = (res.headers.get("location") ?? "").toLowerCase();
  return location.includes("login");
}
