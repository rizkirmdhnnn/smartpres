const CLOUDLAB_DASHBOARD_URL = "https://cloudlab.amikom.ac.id/dashboard.php";

const BROWSER_HEADERS = {
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  referer: "https://cloudlab.amikom.ac.id/dashboard.php",
};

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function getAllByClass(html: string, className: string): string[] {
  const escaped = className.replace(/\./g, "\\.");
  const regex = new RegExp(
    `<(\\w+)[^>]*class="[^"]*${escaped}[^"]*"[^>]*>([\\s\\S]*?)<\\/\\1>`,
    "gi"
  );
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(html)) !== null) {
    out.push(stripHtml(m[2]));
  }
  return out;
}

function parseStatsGrid(html: string): {
  jamMasuk: string;
  shift: string;
  kehadiranBulanIni: string;
  kehadiranDesc: string;
} {
  const defaultResult = {
    jamMasuk: "—",
    shift: "—",
    kehadiranBulanIni: "—",
    kehadiranDesc: "Total Hadir",
  };

  const gridStart = html.indexOf("stats-grid");
  if (gridStart === -1) return defaultResult;
  const slice = html.slice(gridStart, gridStart + 8000);

  const statValues = getAllByClass(slice, "stat-value");
  const statShifts = getAllByClass(slice, "stat-shift");
  const statDescs = getAllByClass(slice, "stat-desc");

  const jamMasuk = statValues[0]?.trim() || "—";
  let shift = statShifts[0]?.trim() || "—";
  shift = shift.replace(/^Shift:\s*/i, "").trim() || "—";
  const kehadiranBulanIni = statValues[1]?.trim() || "—";
  const kehadiranDesc = statDescs.find((d) => /total\s+hadir/i.test(d))?.trim() || statDescs[1]?.trim() || "Total Hadir";

  return {
    jamMasuk,
    shift,
    kehadiranBulanIni,
    kehadiranDesc,
  };
}

export async function GET(request: Request) {
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

    const res = await fetch(CLOUDLAB_DASHBOARD_URL, {
      method: "GET",
      headers: {
        ...BROWSER_HEADERS,
        cookie,
      },
      cache: "no-store",
      redirect: "manual",
    });

    const html = await res.text();

    if (res.status === 301 || res.status === 302) {
      const location = (res.headers.get("location") ?? "").toLowerCase();
      if (location.includes("login")) {
        return Response.json({ error: "Sesi tidak valid. Silakan login lagi." }, { status: 401 });
      }
    }

    const isLoginPageBody =
      html.includes("Email atau password salah!") ||
      (html.includes("<title>") && html.includes("Login - Presensi QR")) ||
      (html.includes("Masukkan email") &&
        html.includes("Masukkan password") &&
        html.includes('name="password"'));

    if (!res.ok && res.status !== 301 && res.status !== 302) {
      return Response.json(
        { error: "Failed to fetch dashboard", status: res.status },
        { status: 502 }
      );
    }

    if (isLoginPageBody) {
      return Response.json({ error: "Sesi tidak valid. Silakan login lagi." }, { status: 401 });
    }

    const stats = parseStatsGrid(html);

    return Response.json({
      success: true,
      ...stats,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return Response.json({ error: message }, { status: 500 });
  }
}
