"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "@/app/hooks/useSession";

type SummaryProfile = {
  name: string;
  nik: string;
  periode: string;
} | null;

type HistoryState = {
  headers: string[];
  rows: string[][];
  summary?: Record<string, string>;
  summaryProfile?: SummaryProfile;
} | null;

function formatDateForInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateDisplay(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function findSummaryByLabel(
  summary: Record<string, string>,
  label: string
): string | null {
  const key = Object.keys(summary).find(
    (k) => k.trim().toLowerCase() === label.toLowerCase()
  );
  return key ? summary[key] : null;
}

function getSummaryFromData(
  data: HistoryState,
  startDate: string,
  endDate: string
) {
  const empty = {
    hadir: 0,
    terlambat: 0,
    totalKeterlambatan: "—",
    jamKerja: "—",
    name: "—",
    nik: "—",
    periode: "—",
  };
  if (!data) return empty;

  const summary = data.summary ?? {};
  const hadirFromHtml = findSummaryByLabel(summary, "Hadir");
  const terlambatFromHtml = findSummaryByLabel(summary, "Terlambat");
  const totalKeterlambatanFromHtml = findSummaryByLabel(
    summary,
    "Total Keterlambatan"
  );
  const jamKerjaFromHtml = findSummaryByLabel(summary, "Jam Kerja");

  let hadir = 0;
  let terlambat = 0;
  if (data.rows.length) {
    for (const row of data.rows) {
      for (const cell of row) {
        const v = String(cell).trim().toLowerCase();
        if (v === "hadir") hadir++;
        if (v === "terlambat") terlambat++;
      }
    }
  }

  const headers = data.headers.map((h) => String(h).toLowerCase());
  const idxKeterlambatan = headers.findIndex(
    (h) => h.includes("keterlambatan") || h.includes("total terlambat")
  );
  const idxJamKerja = headers.findIndex((h) => h.includes("jam kerja"));
  const idxNama = headers.findIndex(
    (h) => h.includes("nama") || h === "name"
  );
  const idxNik = headers.findIndex(
    (h) => h.includes("nik") || h.includes("nip")
  );

  const profile = data.summaryProfile;
  return {
    hadir:
      hadirFromHtml != null ? Number(hadirFromHtml) || hadir : hadir,
    terlambat:
      terlambatFromHtml != null
        ? Number(terlambatFromHtml) || terlambat
        : terlambat,
    totalKeterlambatan:
      totalKeterlambatanFromHtml ??
      (idxKeterlambatan >= 0 && data.rows[0]?.[idxKeterlambatan]
        ? data.rows[0][idxKeterlambatan]
        : "—"),
    jamKerja:
      jamKerjaFromHtml ??
      (idxJamKerja >= 0 && data.rows[0]?.[idxJamKerja]
        ? data.rows[0][idxJamKerja]
        : "—"),
    name:
      profile?.name ??
      (idxNama >= 0 && data.rows[0]?.[idxNama]
        ? data.rows[0][idxNama]
        : "—"),
    nik:
      profile?.nik ??
      (idxNik >= 0 && data.rows[0]?.[idxNik]
        ? data.rows[0][idxNik]
        : "—"),
    periode:
      profile?.periode ??
      (data.rows.length
        ? `${formatDateDisplay(startDate)} - ${formatDateDisplay(endDate)}`
        : "—"),
  };
}

function StatusCell({ value }: { value: string }) {
  const val = String(value).trim().toLowerCase();
  const isTerlambat = val === "terlambat";
  const isHadir = val === "hadir";
  const cellClass = isTerlambat
    ? "font-medium text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400"
    : isHadir
      ? "font-medium text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400"
      : "text-zinc-900 dark:text-zinc-50";
  return <td className={`px-4 py-3 ${cellClass}`}>{value}</td>;
}

export default function HistoryPage() {
  const { getHeaders, clearSession } = useSession();
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const [startDate, setStartDate] = useState(
    formatDateForInput(firstDayOfMonth)
  );
  const [endDate, setEndDate] = useState(formatDateForInput(today));
  const [data, setData] = useState<HistoryState>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set("start_date", startDate);
      if (endDate) params.set("end_date", endDate);
      const res = await fetch(`/api/history?${params.toString()}`, {
        headers: getHeaders(),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Gagal memuat riwayat");
        setData(null);
        if (res.status === 401) clearSession();
        return;
      }
      const headersList = json.headers ?? [];
      const rowsList = json.rows ?? [];
      const colCount = headersList.length;
      const normalizedRows =
        colCount > 0
          ? rowsList.map((row: string[]) => {
              const arr = [...row];
              while (arr.length < colCount) arr.push("");
              return arr.slice(0, colCount);
            })
          : rowsList;
      setData({
        headers: headersList,
        rows: normalizedRows,
        summary: json.summary ?? undefined,
        summaryProfile: json.summaryProfile ?? undefined,
      });
    } catch {
      setError("Gagal memuat riwayat");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, getHeaders, clearSession]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const summaryData = useMemo(
    () => getSummaryFromData(data, startDate, endDate),
    [data, startDate, endDate]
  );

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        History
      </h1>
      <p className="mb-4 text-zinc-600 dark:text-zinc-400">
        Riwayat presensi berdasarkan rentang tanggal.
      </p>

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label
            htmlFor="start_date"
            className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Dari
          </label>
          <input
            id="start_date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
          />
        </div>
        <div>
          <label
            htmlFor="end_date"
            className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Sampai
          </label>
          <input
            id="end_date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
          />
        </div>
        <button
          type="button"
          onClick={fetchHistory}
          disabled={loading}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {loading ? "Memuat…" : "Terapkan"}
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </p>
      )}

      {loading && !data && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Memuat riwayat…
          </p>
        </div>
      )}

      {data && (
        <>
          {/* Summary card */}
          <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {summaryData.name}
            </p>
            <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
              NIK: {summaryData.nik} | Periode: {summaryData.periode}
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg bg-green-50 p-3 dark:bg-green-900/20">
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {summaryData.hadir}
                </p>
                <p className="text-xs font-medium text-green-700 dark:text-green-300">
                  Hadir
                </p>
              </div>
              <div className="rounded-lg bg-red-50 p-3 dark:bg-red-900/20">
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {summaryData.terlambat}
                </p>
                <p className="text-xs font-medium text-red-700 dark:text-red-300">
                  Terlambat
                </p>
              </div>
              <div className="rounded-lg bg-zinc-100 p-3 dark:bg-zinc-800">
                <p className="text-lg font-bold text-zinc-800 dark:text-zinc-200">
                  {summaryData.totalKeterlambatan}
                </p>
                <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Total Keterlambatan
                </p>
              </div>
              <div className="rounded-lg bg-zinc-100 p-3 dark:bg-zinc-800">
                <p className="text-lg font-bold text-zinc-800 dark:text-zinc-200">
                  {summaryData.jamKerja}
                </p>
                <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Jam Kerja
                </p>
              </div>
            </div>
          </div>

          {/* Data table */}
          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            {data.headers.length === 0 && data.rows.length === 0 ? (
              <p className="p-6 text-center text-zinc-500 dark:text-zinc-400">
                Tidak ada data untuk rentang tanggal ini.
              </p>
            ) : (
              <table className="w-full min-w-[500px] text-left text-sm">
                {data.headers.length > 0 && (
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50">
                      {data.headers.map((h, i) => (
                        <th
                          key={i}
                          className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                )}
                <tbody>
                  {data.rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={data.headers.length || 1}
                        className="px-4 py-8 text-center text-zinc-500 dark:text-zinc-400"
                      >
                        Tidak ada data untuk rentang tanggal ini.
                      </td>
                    </tr>
                  ) : (
                    data.rows.map((row, ri) => (
                      <tr
                        key={ri}
                        className="border-b border-zinc-100 last:border-0 dark:border-zinc-800"
                      >
                        {row.map((cell, ci) => (
                          <StatusCell key={ci} value={cell} />
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
