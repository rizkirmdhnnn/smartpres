"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { FullscreenIcon, CloseIcon } from "@/app/components/Icons";

const FALLBACK_COUNTDOWN = 15;
const SSE_RECONNECT_DELAY = 3000;

type AttendanceRecord = Record<string, string>;

function getField(record: AttendanceRecord, ...keys: string[]): string {
  for (const k of keys) {
    if (record[k]) return record[k];
  }
  return "—";
}

const field = {
  name: (r: AttendanceRecord) =>
    getField(r, "nama_lengkap", "nama", "name", "full_name"),
  shift: (r: AttendanceRecord) =>
    getField(r, "shift", "shift_name", "shift_kerja"),
  jamMasuk: (r: AttendanceRecord) =>
    getField(r, "jam_masuk", "check_in", "waktu_masuk", "waktu", "jam", "time"),
  jamKeluar: (r: AttendanceRecord) =>
    getField(r, "jam_keluar", "check_out", "waktu_keluar"),
  status: (r: AttendanceRecord) =>
    getField(r, "status_text", "status", "keterangan"),
};

function QRSection({
  token,
  tokenLoading,
  tokenError,
  countdown,
  copySuccess,
  isFullscreen,
  onFetchToken,
  onCopyToken,
}: {
  token: string | null;
  tokenLoading: boolean;
  tokenError: string | null;
  countdown: number;
  copySuccess: boolean;
  isFullscreen: boolean;
  onFetchToken: () => void;
  onCopyToken: () => void;
}) {
  const qrSize = isFullscreen ? 320 : 200;
  return (
    <section className="flex flex-col items-center gap-4 self-start rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="self-start text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        QR Presensi
      </h2>
      {tokenLoading && !token && (
        <div
          className="flex items-center justify-center rounded-lg border-2 border-zinc-200 bg-white dark:border-zinc-700 dark:bg-white"
          style={{ width: qrSize, height: qrSize }}
        >
          <p className="text-xs text-zinc-400">Memuat QR…</p>
        </div>
      )}
      {tokenError && !token && (
        <div
          className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30"
          style={{ width: qrSize, height: qrSize }}
        >
          <p className="text-xs text-red-600 dark:text-red-400">
            {tokenError}
          </p>
          <button
            type="button"
            onClick={onFetchToken}
            className="text-xs font-medium text-red-700 underline dark:text-red-300"
          >
            Coba lagi
          </button>
        </div>
      )}
      {token && (
        <div className="rounded-lg border-2 border-zinc-200 bg-white p-2 dark:border-zinc-700 dark:bg-white">
          <QRCodeSVG
            value={token}
            size={qrSize}
            level="M"
            bgColor="#ffffff"
            fgColor="#18181b"
            includeMargin={false}
          />
        </div>
      )}
      {token && (
        <div className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 px-2.5 py-1 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
          <span className="font-mono">{countdown}s</span>
          <span>sampai QR berikutnya</span>
        </div>
      )}
      <div className="w-full space-y-1">
        <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Token
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            readOnly
            value={token ?? "—"}
            className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-1.5 font-mono text-xs text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
          />
          <button
            type="button"
            onClick={onCopyToken}
            disabled={!token}
            className="shrink-0 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {copySuccess ? "Tersalin" : "Salin"}
          </button>
        </div>
      </div>
      <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
        Scan QR code atau salin token untuk presensi
      </p>
    </section>
  );
}

export default function PresensiDisplayPage() {
  const [token, setToken] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(FALLBACK_COUNTDOWN);
  const [copySuccess, setCopySuccess] = useState(false);
  const [tokenLoading, setTokenLoading] = useState(true);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [sseStatus, setSseStatus] = useState<
    "connecting" | "connected" | "error"
  >("connecting");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const fullscreenRef = useRef<HTMLDivElement>(null);

  const fetchToken = useCallback(async () => {
    setTokenLoading(true);
    setTokenError(null);
    try {
      const res = await fetch("/api/token");
      const json = await res.json();
      if (!res.ok || !json.token) {
        setTokenError(json?.error ?? "Gagal memuat token");
        return;
      }
      setToken(json.token);
      if (json.expired_at) {
        const diff = Math.max(
          1,
          Math.round((new Date(json.expired_at).getTime() - Date.now()) / 1000)
        );
        setCountdown(diff > 0 && diff < 120 ? diff : FALLBACK_COUNTDOWN);
      } else {
        setCountdown(FALLBACK_COUNTDOWN);
      }
    } catch {
      setTokenError("Gagal memuat token");
    } finally {
      setTokenLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchToken();
  }, [fetchToken]);

  useEffect(() => {
    if (tokenLoading || tokenError) return;
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchToken();
          return FALLBACK_COUNTDOWN;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [tokenLoading, tokenError, fetchToken]);

  // SSE with auto-reconnect
  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let es: EventSource;

    function connect() {
      setSseStatus("connecting");
      es = new EventSource("/api/presensi-stream");
      eventSourceRef.current = es;

      es.addEventListener("presensi_update", (event) => {
        try {
          const data = JSON.parse(event.data);
          if (Array.isArray(data)) setAttendance(data);
        } catch {
          /* ignore parse errors */
        }
        setSseStatus("connected");
      });

      es.onopen = () => setSseStatus("connected");

      es.onerror = () => {
        setSseStatus("error");
        es.close();
        eventSourceRef.current = null;
        reconnectTimer = setTimeout(connect, SSE_RECONNECT_DELAY);
      };
    }

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      es?.close();
      eventSourceRef.current = null;
    };
  }, []);

  const handleCopyToken = useCallback(async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      setCopySuccess(false);
    }
  }, [token]);

  const toggleFullscreen = useCallback(async () => {
    const el = fullscreenRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setIsFullscreen(false);
      } else {
        await el.requestFullscreen();
        setIsFullscreen(true);
      }
    } catch {
      setIsFullscreen(!!document.fullscreenElement);
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  return (
    <div
      ref={fullscreenRef}
      className={`min-h-0 ${isFullscreen ? "min-h-screen bg-zinc-100 p-6 dark:bg-zinc-950" : ""}`}
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Presensi Display
          </h1>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">
            QR presensi real-time dan daftar kehadiran.
          </p>
        </div>
        <button
          type="button"
          onClick={toggleFullscreen}
          className="flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          title={isFullscreen ? "Keluar fullscreen (Esc)" : "Fullscreen"}
        >
          {isFullscreen ? (
            <>
              <CloseIcon className="h-5 w-5" />
              Keluar fullscreen
            </>
          ) : (
            <>
              <FullscreenIcon className="h-5 w-5" />
              Fullscreen
            </>
          )}
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <QRSection
          token={token}
          tokenLoading={tokenLoading}
          tokenError={tokenError}
          countdown={countdown}
          copySuccess={copySuccess}
          isFullscreen={isFullscreen}
          onFetchToken={fetchToken}
          onCopyToken={handleCopyToken}
        />

        <section className="rounded-xl border border-zinc-200 bg-white lg:col-span-2 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-700">
            <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Daftar Presensi
            </h2>
            <div className="flex items-center gap-2">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  sseStatus === "connected"
                    ? "bg-green-500"
                    : sseStatus === "connecting"
                      ? "animate-pulse bg-amber-400"
                      : "bg-red-500"
                }`}
              />
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {sseStatus === "connected"
                  ? "Live"
                  : sseStatus === "connecting"
                    ? "Menghubungkan…"
                    : "Terputus"}
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50">
                  {["No", "Nama", "Shift", "Jam Masuk", "Jam Keluar", "Status"].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {attendance.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-zinc-500 dark:text-zinc-400"
                    >
                      {sseStatus === "connecting"
                        ? "Memuat data presensi…"
                        : "Belum ada data presensi."}
                    </td>
                  </tr>
                ) : (
                  attendance.map((row, i) => {
                    const status = field.status(row);
                    const isLate = /terlambat|late/i.test(status);
                    return (
                      <tr
                        key={i}
                        className="border-b border-zinc-100 last:border-0 dark:border-zinc-800"
                      >
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                          {i + 1}
                        </td>
                        <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">
                          {field.name(row)}
                        </td>
                        <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                          {field.shift(row)}
                        </td>
                        <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                          {field.jamMasuk(row)}
                        </td>
                        <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                          {field.jamKeluar(row)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              isLate
                                ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                                : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            }`}
                          >
                            {status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
