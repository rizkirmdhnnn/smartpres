import { resolveSessionCookie, unauthorizedResponse } from "@/app/lib/session";
import {
  CLOUDLAB_BASE,
  BROWSER_HEADERS,
  stripHtml,
  isCloudLabLoginPage,
  isRedirectToLogin,
} from "@/app/lib/cloudlab";

const CLOUDLAB_DASHBOARD_URL = `${CLOUDLAB_BASE}/dashboard.php`;

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

function parseStatsGrid(html: string) {
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
  const kehadiranDesc =
    statDescs.find((d) => /total\s+hadir/i.test(d))?.trim() ||
    statDescs[1]?.trim() ||
    "Total Hadir";

  return { jamMasuk, shift, kehadiranBulanIni, kehadiranDesc };
}

export async function GET(request: Request) {
  try {
    const cookie = resolveSessionCookie(request);
    if (!cookie) return unauthorizedResponse("Session required");

    const res = await fetch(CLOUDLAB_DASHBOARD_URL, {
      method: "GET",
      headers: {
        ...BROWSER_HEADERS,
        referer: CLOUDLAB_DASHBOARD_URL,
        cookie,
      },
      cache: "no-store",
      redirect: "manual",
    });

    const html = await res.text();

    if (isRedirectToLogin(res)) return unauthorizedResponse();

    if (!res.ok && res.status !== 301 && res.status !== 302) {
      return Response.json(
        { error: "Failed to fetch dashboard", status: res.status },
        { status: 502 }
      );
    }

    if (isCloudLabLoginPage(html)) return unauthorizedResponse();

    return Response.json({ success: true, ...parseStatsGrid(html) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return Response.json({ error: message }, { status: 500 });
  }
}
