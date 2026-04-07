// ─── Primitives ──────────────────────────────────────────────────────────────

export function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

export function getAllByClass(html: string, className: string): string[] {
  const escaped = className.replace(/\./g, "\\.");
  const regex = new RegExp(
    `<(\\w+)[^>]*class="[^"]*${escaped}[^"]*"[^>]*>([\\s\\S]*?)<\\/\\1>`,
    "gi",
  );
  const results: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    results.push(stripHtml(match[2]));
  }
  return results;
}

// ─── Login page detection ────────────────────────────────────────────────────

export function isLoginPage(html: string): boolean {
  if (html.includes("Email atau password salah!")) return true;
  if (html.includes("Login - Presensi QR")) return true;

  const hasEmailField = html.includes("Masukkan email");
  const hasPasswordField =
    html.includes("Masukkan password") || html.includes('name="password"');
  return hasEmailField && hasPasswordField;
}

// ─── Table parsing (used by history) ─────────────────────────────────────────

export interface ParsedTable {
  headers: string[];
  rows: string[][];
}

function parseOneTable(tableContent: string): ParsedTable {
  const headers: string[] = [];
  const rows: string[][] = [];

  const theadMatch = tableContent.match(
    /<thead[\s\S]*?>([\s\S]*?)<\/thead>/i,
  );
  if (theadMatch) {
    const thMatches = [
      ...theadMatch[1].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi),
    ];
    thMatches.forEach((m) => headers.push(stripHtml(m[1])));
  }

  const tbodyMatch = tableContent.match(
    /<tbody[\s\S]*?>([\s\S]*?)<\/tbody>/i,
  );
  const bodyContent = tbodyMatch ? tbodyMatch[1] : tableContent;

  const trMatches = [...bodyContent.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  for (const trMatch of trMatches) {
    const cellMatches = [
      ...trMatch[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi),
    ];
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

export function parseTableFromHtml(html: string): ParsedTable {
  const tableRegex = /<table[\s\S]*?>([\s\S]*?)<\/table>/gi;
  const tables: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = tableRegex.exec(html)) !== null) {
    tables.push(match[1]);
  }

  if (tables.length === 0) return { headers: [], rows: [] };

  let best: ParsedTable = { headers: [], rows: [] };
  for (const content of tables) {
    const parsed = parseOneTable(content);
    if (parsed.rows.length > best.rows.length) {
      best = parsed;
    }
  }

  if (best.rows.length === 0) {
    best = parseOneTable(tables[0]);
  }
  return best;
}

// ─── Mini-stat parsing (used by history) ─────────────────────────────────────

export function parseMiniStats(html: string): Record<string, string> {
  const result: Record<string, string> = {};
  const itemRegex =
    /<div[^>]*class="[^"]*mini-stat-item[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
  let block: RegExpExecArray | null;
  while ((block = itemRegex.exec(html)) !== null) {
    const inner = block[1];
    const valMatch = inner.match(
      /<span[^>]*class="[^"]*mini-stat-val[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
    );
    const labelMatch = inner.match(
      /<span[^>]*class="[^"]*mini-stat-label[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
    );
    const val = valMatch ? stripHtml(valMatch[1]) : "";
    const label = labelMatch ? stripHtml(labelMatch[1]) : "";
    if (label) result[label.trim()] = val.trim();
  }
  return result;
}

// ─── Profile summary parsing (used by history) ──────────────────────────────

export interface ProfileSummary {
  name: string;
  nik: string;
  periode: string;
}

export function parseSummaryBox(html: string): ProfileSummary | null {
  const profileMatch = html.match(
    /<div[^>]*class="[^"]*profile-info[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
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

// ─── Dashboard stats parsing ─────────────────────────────────────────────────

export interface DashboardStats {
  jamMasuk: string;
  shift: string;
  kehadiranBulanIni: string;
  kehadiranDesc: string;
}

export function parseStatsGrid(html: string): DashboardStats {
  const fallback: DashboardStats = {
    jamMasuk: "—",
    shift: "—",
    kehadiranBulanIni: "—",
    kehadiranDesc: "Total Hadir",
  };

  const gridStart = html.indexOf("stats-grid");
  if (gridStart === -1) return fallback;

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
