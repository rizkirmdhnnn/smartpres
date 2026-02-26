import { resolveSessionCookie, unauthorizedResponse } from "@/app/lib/session";
import {
  CLOUDLAB_BASE,
  BROWSER_HEADERS,
  stripHtml,
  isCloudLabLoginPage,
  isRedirectToLogin,
} from "@/app/lib/cloudlab";

const CLOUDLAB_RIWAYAT_URL = `${CLOUDLAB_BASE}/riwayat.php`;

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

  if (tables.length === 0) return { headers: [], rows: [] };

  let best = { headers: [] as string[], rows: [] as string[][] };
  for (const tableContent of tables) {
    const parsed = parseOneTable(tableContent);
    if (parsed.rows.length > best.rows.length) best = parsed;
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

function parseSummaryBox(
  html: string
): { name: string; nik: string; periode: string } | null {
  const profileMatch = html.match(
    /<div[^>]*class="[^"]*profile-info[^"]*"[^>]*>([\s\S]*?)<\/div>/i
  );
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
    const cookie = resolveSessionCookie(request);
    if (!cookie) return unauthorizedResponse("Session required");

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
        referer: CLOUDLAB_RIWAYAT_URL,
        cookie,
      },
      cache: "no-store",
      redirect: "manual",
    });

    const html = await res.text();

    if (isRedirectToLogin(res)) return unauthorizedResponse();

    if (!res.ok && res.status !== 301 && res.status !== 302) {
      return Response.json(
        { error: "Failed to fetch history", status: res.status },
        { status: 502 }
      );
    }

    if (isCloudLabLoginPage(html)) return unauthorizedResponse();

    const parsed = parseTableFromHtml(html);
    const miniStats = parseMiniStats(html);
    const summaryProfile = parseSummaryBox(html);

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
