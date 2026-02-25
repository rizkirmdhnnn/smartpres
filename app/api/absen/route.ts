const CLOUDLAB_BASE = "https://cloudlab.amikom.ac.id";
const CLOUDLAB_PRESENSI_URL = `${CLOUDLAB_BASE}/process_presensi.php`;

const BROWSER_HEADERS: Record<string, string> = {
  accept: "*/*",
  "accept-language": "en-US,en;q=0.9",
  "user-agent":
    "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Mobile Safari/537.36",
  referer: `${CLOUDLAB_BASE}/scan.php`,
};

export async function POST(request: Request) {
  try {
    // ── 1. Resolve session cookie ──────────────────────────────────
    const sessionCookie = request.headers.get("X-Session-Cookie");
    const sessionId =
      request.headers.get("X-Session-Id") ??
      request.headers.get("cookie")?.match(/PHPSESSID=([^;]+)/)?.[1];

    let cookie = sessionCookie?.trim() || null;
    if (!cookie && sessionId) {
      const sid = sessionId.trim();
      if (sid.includes("%3A") || sid.length > 50) {
        cookie = `remember_me=${sid}`;
      } else {
        cookie = `PHPSESSID=${sid}`;
      }
    }
    if (!cookie) {
      return Response.json({ error: "Session required" }, { status: 401 });
    }

    // ── 2. Extract token from request body ─────────────────────────
    const body = await request.json();
    const token = typeof body?.token === "string" ? body.token.trim() : null;
    if (!token) {
      return Response.json({ error: "Token required" }, { status: 400 });
    }

    // ── 3. Build the URL exactly like the real scan page ───────────
    //    GET /process_presensi.php?action=scan&token=<value>
    const url = new URL(CLOUDLAB_PRESENSI_URL);
    url.searchParams.set("action", "scan");
    url.searchParams.set("token", token);

    console.log("[absen] Requesting:", url.toString());

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        ...BROWSER_HEADERS,
        cookie,
      },
      cache: "no-store",
      redirect: "manual",
    });

    // ── 4. Handle redirects (likely session expired) ───────────────
    if (res.status === 301 || res.status === 302) {
      const location = (res.headers.get("location") ?? "").toLowerCase();
      if (location.includes("login")) {
        return Response.json(
          { error: "Sesi tidak valid. Silakan login lagi." },
          { status: 401 }
        );
      }
    }

    // ── 5. Parse the response ──────────────────────────────────────
    const contentType = res.headers.get("content-type") ?? "";
    const rawText = await res.text();

    console.log("[absen] CloudLab response:", {
      status: res.status,
      contentType,
      bodyLength: rawText.length,
      bodySnippet: rawText.slice(0, 500),
      token: token.slice(0, 20) + (token.length > 20 ? "..." : ""),
    });

    // Response is JSON based on network tab (content-type: application/json)
    if (contentType.includes("application/json")) {
      try {
        const json = JSON.parse(rawText);
        console.log("[absen] Parsed JSON:", json);

        // Detect success/failure from the JSON response
        const msg = (json?.message ?? json?.msg ?? json?.status ?? "").toString().toLowerCase();
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
          message: isSuccess && !isError
            ? json?.message ?? json?.msg ?? "Presensi berhasil dicatat."
            : json?.message ?? json?.msg ?? "Presensi gagal.",
          raw: json,
        });
      } catch {
        // JSON parse failed, fall through to HTML handling
      }
    }

    // ── 6. Fallback: treat as HTML (login page detection etc.) ─────
    const htmlLower = rawText.toLowerCase();

    const isLoginPage =
      rawText.includes("Login - Presensi QR") ||
      rawText.includes("Masukkan email") ||
      rawText.includes('name="password"');

    if (isLoginPage) {
      return Response.json(
        { error: "Sesi tidak valid. Silakan login lagi." },
        { status: 401 }
      );
    }

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

    console.log("[absen] Fallback HTML detection:", { hasPositiveSignal, hasNegativeSignal, success });

    return Response.json({
      success: !!success,
      message: success
        ? "Presensi berhasil dicatat."
        : hasNegativeSignal
          ? "Presensi gagal: " + rawText.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200)
          : "Presensi mungkin gagal. Periksa riwayat.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return Response.json({ error: message }, { status: 500 });
  }
}
