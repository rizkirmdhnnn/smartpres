const CLOUDLAB_RIWAYAT_URL = "https://cloudlab.amikom.ac.id/riwayat.php";

const BROWSER_HEADERS = {
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  referer: "https://cloudlab.amikom.ac.id/riwayat.php",
};

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function parseOneTable(tableContent: string): { headers: string[]; rows: string[][] } {
  const headers: string[] = [];
  const rows: string[][] = [];

  const theadMatch = tableContent.match(/<thead[\s\S]*?>([\s\S]*?)<\/thead>/i);
  if (theadMatch) {
    const thMatches = [...theadMatch[1].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)];
    thMatches.forEach((m) => headers.push(stripHtml(m[1])));
  }

  const tbodyMatch = tableContent.match(/<tbody[\s\S]*?>([\s\S]*?)<\/tbody>/i);
  const bodyContent = tbodyMatch ? tbodyMatch[1] : tableContent;

  const trMatches = [...bodyContent.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  for (const trMatch of trMatches) {
    const cellMatches = [...trMatch[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)];
    const cells = cellMatches.map((m) => stripHtml(m[1]));
    if (cells.length === 0) continue;
    if (headers.length === 0 && rows.length === 0) {
      headers.push(...cells);
    } else {
      rows.push(cells);
    }
  }

  if (headers.length === 0 && rows.length > 0) {
    return { headers: rows[0], rows: rows.slice(1) };
  }
  return { headers, rows };
}

function parseTableFromHtml(html: string): { headers: string[]; rows: string[][] } {
  const tableRegex = /<table[\s\S]*?>([\s\S]*?)<\/table>/gi;
  const tables: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = tableRegex.exec(html)) !== null) {
    tables.push(m[1]);
  }

  if (tables.length === 0) {
    return { headers: [], rows: [] };
  }

  let best = { headers: [] as string[], rows: [] as string[][] };
  for (const tableContent of tables) {
    const parsed = parseOneTable(tableContent);
    if (parsed.rows.length > best.rows.length) {
      best = parsed;
    }
  }

  if (best.rows.length === 0 && tables.length > 0) {
    best = parseOneTable(tables[0]);
  }
  return best;
}

function parseMiniStats(html: string): Record<string, string> {
  const result: Record<string, string> = {};
  const itemRegex = /<div[^>]*class="[^"]*mini-stat-item[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
  let block: RegExpExecArray | null;
  while ((block = itemRegex.exec(html)) !== null) {
    const inner = block[1];
    const valMatch = inner.match(/<span[^>]*class="[^"]*mini-stat-val[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
    const labelMatch = inner.match(/<span[^>]*class="[^"]*mini-stat-label[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
    const val = valMatch ? stripHtml(valMatch[1]) : "";
    const label = labelMatch ? stripHtml(labelMatch[1]) : "";
    if (label) result[label.trim()] = val.trim();
  }
  return result;
}

function parseSummaryBox(html: string): { name: string; nik: string; periode: string } | null {
  const profileMatch = html.match(/<div[^>]*class="[^"]*profile-info[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  if (!profileMatch) return null;
  const inner = profileMatch[1];
  const h3Match = inner.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
  const pMatch = inner.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  const name = h3Match ? stripHtml(h3Match[1]) : "";
  const pText = pMatch ? stripHtml(pMatch[1]) : "";
  const nikMatch = pText.match(/NIK:\s*(\S+)/i);
  const periodeMatch = pText.match(/Periode:\s*([\d/\s\-]+)/i);
  return {
    name: name.trim(),
    nik: nikMatch ? nikMatch[1].trim() : "",
    periode: periodeMatch ? periodeMatch[1].trim() : "",
  };
}

export async function GET(request: Request) {
  try {
    const sessionCookie = request.headers.get("X-Session-Cookie");
    const sessionId = request.headers.get("X-Session-Id") ?? request.headers.get("cookie")?.match(/PHPSESSID=([^;]+)/)?.[1];
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

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("start_date") ?? "";
    const endDate = searchParams.get("end_date") ?? "";

    const url = new URL(CLOUDLAB_RIWAYAT_URL);
    if (startDate) url.searchParams.set("start_date", startDate);
    if (endDate) url.searchParams.set("end_date", endDate);
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        ...BROWSER_HEADERS,
        cookie,
      },
      cache: "no-store",
      redirect: "manual",
    });

    const html = await res.text();

    // Redirect to login = session invalid
    if (res.status === 301 || res.status === 302) {
      const location = (res.headers.get("location") ?? "").toLowerCase();
      if (location.includes("login")) {
        console.log("[history] Redirect to login, session invalid");
        return Response.json({ error: "Sesi tidak valid. Silakan login lagi." }, { status: 401 });
      }
    }

    // Response body is the login page (200 but content is login form)
    const isLoginPageBody =
      html.includes("Email atau password salah!") ||
      (html.includes("<title>") && html.includes("Login - Presensi QR")) ||
      (html.includes("Masukkan email") && html.includes("Masukkan password") && html.includes('name="password"'));

    console.log("[history] CloudLab response:", {
      status: res.status,
      htmlLength: html.length,
      isLoginPageBody,
      cookiePrefix: cookie.slice(0, 30) + "...",
    });
    if (isLoginPageBody) console.log("[history] Response body (login page):\n", html.slice(0, 1500));

    if (!res.ok && res.status !== 301 && res.status !== 302) {
      return Response.json({ error: "Failed to fetch history", status: res.status }, { status: 502 });
    }

    if (isLoginPageBody) {
      return Response.json({ error: "Sesi tidak valid. Silakan login lagi." }, { status: 401 });
    }

    const parsed = parseTableFromHtml(html);
    const miniStats = parseMiniStats(html);
    const summaryProfile = parseSummaryBox(html);

    if (parsed.rows.length === 0 && parsed.headers.length === 0) {
      const tableSnippet = html.includes("<table") ? html.slice(html.indexOf("<table"), html.indexOf("<table") + 600) : "(no table found)";
      console.log("[history] No table parsed. Snippet:", tableSnippet);
    } else {
      console.log("[history] Parsed:", { headerCount: parsed.headers.length, rowCount: parsed.rows.length });
    }

    return Response.json({
      success: true,
      ...parsed,
      summary: miniStats,
      summaryProfile: summaryProfile ?? undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return Response.json({ error: message }, { status: 500 });
  }
}
