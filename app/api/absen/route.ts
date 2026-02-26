import { resolveSessionCookie, unauthorizedResponse } from "@/app/lib/session";
import { CLOUDLAB_BASE, BROWSER_HEADERS } from "@/app/lib/cloudlab";

const CLOUDLAB_PRESENSI_URL = `${CLOUDLAB_BASE}/process_presensi.php`;

export async function POST(request: Request) {
  try {
    // ── 1. Resolve session cookie ──────────────────────────────────
    const cookie = resolveSessionCookie(request);
    if (!cookie) return unauthorizedResponse("Session required");

    // ── 2. Extract token from request body ─────────────────────────
    const body = await request.json();
    const token = typeof body?.token === "string" ? body.token.trim() : null;
    if (!token) {
      return Response.json({ error: "Token required" }, { status: 400 });
    }

    // ── 3. Build the URL exactly like the real scan page ───────────
    const url = new URL(CLOUDLAB_PRESENSI_URL);
    url.searchParams.set("action", "scan");
    url.searchParams.set("token", token);

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        ...BROWSER_HEADERS,
        referer: `${CLOUDLAB_BASE}/scan.php`,
        "user-agent":
          "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Mobile Safari/537.36",
        cookie,
      },
      cache: "no-store",
      redirect: "manual",
    });

    // ── 4. Handle redirects (likely session expired) ───────────────
    if (res.status === 301 || res.status === 302) {
      const location = (res.headers.get("location") ?? "").toLowerCase();
      if (location.includes("login")) return unauthorizedResponse();
    }

    // ── 5. Parse the response ──────────────────────────────────────
    const contentType = res.headers.get("content-type") ?? "";
    const rawText = await res.text();

    // Response is JSON (content-type: application/json)
    if (contentType.includes("application/json")) {
      try {
        const json = JSON.parse(rawText);
        const msg = (json?.message ?? json?.msg ?? json?.status ?? "")
          .toString()
          .toLowerCase();
        const isSuccess =
          res.ok &&
          (json?.success === true ||
            json?.status === "success" ||
            msg.includes("berhasil") ||
            msg.includes("success") ||
            msg.includes("terima kasih"));
        const isError =
          json?.success === false ||
          json?.status === "error" ||
          json?.status === "fail" ||
          msg.includes("gagal") ||
          msg.includes("tidak valid") ||
          msg.includes("invalid") ||
          msg.includes("expired") ||
          msg.includes("kadaluarsa");

        return Response.json({
          success: isSuccess && !isError,
          message:
            isSuccess && !isError
              ? json?.message ?? json?.msg ?? "Presensi berhasil dicatat."
              : json?.message ?? json?.msg ?? "Presensi gagal.",
          raw: json,
        });
      } catch {
        // JSON parse failed, fall through to HTML handling
      }
    }

    // ── 6. Fallback: treat as HTML ─────────────────────────────────
    const htmlLower = rawText.toLowerCase();

    const isLoginPage =
      rawText.includes("Login - Presensi QR") ||
      rawText.includes("Masukkan email") ||
      rawText.includes('name="password"');

    if (isLoginPage) return unauthorizedResponse();

    const hasPositiveSignal =
      htmlLower.includes("berhasil") ||
      htmlLower.includes("success") ||
      htmlLower.includes("terima kasih");

    const hasNegativeSignal =
      htmlLower.includes("gagal") ||
      htmlLower.includes("tidak valid") ||
      htmlLower.includes("invalid") ||
      htmlLower.includes("expired") ||
      htmlLower.includes("kadaluarsa") ||
      htmlLower.includes("error");

    const success = res.ok && !isLoginPage && hasPositiveSignal && !hasNegativeSignal;

    return Response.json({
      success: !!success,
      message: success
        ? "Presensi berhasil dicatat."
        : hasNegativeSignal
          ? "Presensi gagal: " +
            rawText
              .replace(/<[^>]+>/g, " ")
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, 200)
          : "Presensi mungkin gagal. Periksa riwayat.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return Response.json({ error: message }, { status: 500 });
  }
}
