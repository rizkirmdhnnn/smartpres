const CLOUDLAB_ABSEN_URL = "https://cloudlab.amikom.ac.id/scan_absen.php";

const BROWSER_HEADERS = {
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
  "content-type": "application/x-www-form-urlencoded",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  referer: "https://cloudlab.amikom.ac.id/",
};

export async function POST(request: Request) {
  try {
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

    const body = await request.json();
    const token = typeof body?.token === "string" ? body.token.trim() : null;
    if (!token) {
      return Response.json({ error: "Token required" }, { status: 400 });
    }

    const formBody = new URLSearchParams();
    formBody.set("token", token);

    const res = await fetch(CLOUDLAB_ABSEN_URL, {
      method: "POST",
      headers: {
        ...BROWSER_HEADERS,
        cookie,
      },
      body: formBody.toString(),
      cache: "no-store",
      redirect: "manual",
    });

    const html = await res.text();

    if (res.status === 301 || res.status === 302) {
      const location = (res.headers.get("location") ?? "").toLowerCase();
      if (location.includes("login")) {
        return Response.json(
          { error: "Sesi tidak valid. Silakan login lagi." },
          { status: 401 }
        );
      }
    }

    const isLoginPage =
      html.includes("Login - Presensi QR") ||
      html.includes("Masukkan email") ||
      html.includes('name="password"');

    if (isLoginPage) {
      return Response.json(
        { error: "Sesi tidak valid. Silakan login lagi." },
        { status: 401 }
      );
    }

    const success =
      res.ok &&
      !isLoginPage &&
      (html.toLowerCase().includes("berhasil") ||
        html.toLowerCase().includes("success") ||
        html.toLowerCase().includes("terima kasih") ||
        !html.toLowerCase().includes("gagal"));

    return Response.json({
      success: !!success,
      message: success ? "Presensi berhasil dicatat." : "Presensi mungkin gagal. Periksa riwayat.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return Response.json({ error: message }, { status: 500 });
  }
}
