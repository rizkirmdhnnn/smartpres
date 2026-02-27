"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "@/app/hooks/useSession";

type DashboardResponse = {
  success?: boolean;
  jamMasuk: string;
  shift: string;
  kehadiranBulanIni: string;
  kehadiranDesc: string;
};

const RUPIAH_FORMATTER = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  minimumFractionDigits: 0,
});

export default function DashboardPage() {
  const { getHeaders, clearSession } = useSession();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard", { headers: getHeaders() });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Gagal memuat data");
        setData(null);
        if (res.status === 401) clearSession();
        return;
      }
      setData({
        jamMasuk: json.jamMasuk ?? "—",
        shift: json.shift ?? "—",
        kehadiranBulanIni: json.kehadiranBulanIni ?? "—",
        kehadiranDesc: json.kehadiranDesc ?? "Total Hadir",
      });
    } catch {
      setError("Gagal memuat data");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [getHeaders, clearSession]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const bulanIni = useMemo(
    () => new Date().toLocaleDateString("id-ID", { month: "long", year: "numeric" }),
    []
  );

  const kehadiranCount = data?.kehadiranBulanIni
    ? parseInt(data.kehadiranBulanIni.replace(/\D/g, ""), 10) || 0
    : 0;
  const estimateIncome = kehadiranCount * 50_000;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Dashboard
      </h1>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/30">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          <button
            type="button"
            onClick={fetchDashboard}
            className="mt-2 text-sm font-medium text-red-800 underline dark:text-red-300"
          >
            Coba lagi
          </button>
        </div>
      )}

      {loading && !data && (
        <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-3">
          {[32, 40, 40].map((w, i) => (
            <div
              key={i}
              className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div
                className="h-4 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700"
                style={{ width: `${w * 4}px` }}
              />
              <div className="mt-4 h-6 w-24 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
            </div>
          ))}
        </div>
      )}

      {(!loading || data) && (
        <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-3">
          <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Presensi Hari Ini
            </h2>
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-zinc-600 dark:text-zinc-400">Jam masuk</span>
                <span className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                  {data?.jamMasuk ?? "—"}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-zinc-600 dark:text-zinc-400">Shift</span>
                <span className="font-medium text-zinc-900 dark:text-zinc-50">
                  {data?.shift ?? "—"}
                </span>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Kehadiran Bulan Ini
            </h2>
            <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
              {data?.kehadiranBulanIni ?? "—"}
            </p>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {data?.kehadiranDesc ?? "Total Hadir"} · {bulanIni}
            </p>
          </section>

          <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Estimasi Pendapatan
            </h2>
            <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
              {data ? RUPIAH_FORMATTER.format(estimateIncome) : "—"}
            </p>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Rp 50.000 per kehadiran · {bulanIni}
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
