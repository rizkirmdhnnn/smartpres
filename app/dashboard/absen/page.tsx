"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "@/app/hooks/useSession";
import { Alert } from "@/app/components/Alert";
import { ShiftWarningModal } from "@/app/components/ShiftWarningModal";
import shiftData from "@/lib/shift-schedule.json";

const SCANNER_ID = "qr-scanner-root";
const FALLBACK_COUNTDOWN = 15;
const USER_NAME_KEY = "smartpres_userName";

type StopScannerCallback = () => void;

declare global {
  interface Window {
    __smartpresStopScanner?: (onDone: () => void) => void;
  }
}

/* ── Day helper ─────────────────────────────────────────────────────── */

const DAY_MAP: Record<number, string> = {
  1: "Senin",
  2: "Selasa",
  3: "Rabu",
  4: "Kamis",
  5: "Jumat",
  6: "Sabtu",
  0: "Minggu",
};

function getDayName(): string {
  return DAY_MAP[new Date().getDay()] ?? "";
}

/* ── Shift checker ──────────────────────────────────────────────────── */

type ShiftWarning = {
  title: string;
  message: string;
  detail?: string;
} | null;

function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

function formatCurrentTime(): string {
  const now = new Date();
  return now.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function checkShiftWarning(userName: string | null): ShiftWarning {
  if (!userName) return null;

  const dayName = getDayName();
  const isWeekend = dayName === "Sabtu" || dayName === "Minggu";

  // Find user in schedule (case-insensitive comparison)
  const userSchedule = shiftData.schedule.find(
    (s) => s.name.toLowerCase() === userName.toLowerCase()
  );

  // User not found → no warning (fail-safe)
  if (!userSchedule) return null;

  // Weekend check
  if (isWeekend) {
    return {
      title: "Tidak Ada Shift Hari Ini",
      message: `Hari ini ${dayName}, Anda tidak memiliki jadwal shift.`,
      detail: `Waktu sekarang: ${formatCurrentTime()} — Apakah Anda yakin ingin absen?`,
    };
  }

  // Get today's shift
  const todayShift = (userSchedule.days as Record<string, string>)[dayName];
  if (!todayShift) return null;

  const shiftConfig = (shiftData.shifts as Record<string, { label: string; startTime: string; endTime: string; graceMinutesBefore: number; description: string }>)[todayShift];
  if (!shiftConfig) return null;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const shiftStart = timeToMinutes(shiftConfig.startTime);
  const shiftEnd = timeToMinutes(shiftConfig.endTime);
  const graceMinutes = shiftConfig.graceMinutesBefore;

  // Valid window: (shiftStart - graceMinutes) to shiftEnd
  const windowStart = shiftStart - graceMinutes;
  const windowEnd = shiftEnd;

  if (currentMinutes < windowStart || currentMinutes > windowEnd) {
    return {
      title: "Bukan Waktu Shift Anda",
      message: `Hari ini shift Anda adalah ${shiftConfig.label} (${shiftConfig.startTime} – ${shiftConfig.endTime}).`,
      detail: `Waktu sekarang: ${formatCurrentTime()} — Di luar jam shift Anda`,
    };
  }

  return null;
}

/* ── Scanner helpers ────────────────────────────────────────────────── */

function safeStopScanner(
  ref: React.MutableRefObject<{ stop: () => Promise<void> } | null>,
  onDone?: StopScannerCallback
): void {
  const scanner = ref.current;
  if (!scanner) {
    onDone?.();
    return;
  }
  ref.current = null;
  const done = () => onDone?.();
  try {
    scanner
      .stop()
      .catch(() => {})
      .finally(done);
  } catch {
    done();
  }
}

function extractTokenFromDecoded(decoded: string): string {
  const trimmed = decoded.trim();
  try {
    const url = new URL(trimmed);
    return url.searchParams.get("token") ?? url.searchParams.get("q") ?? trimmed;
  } catch {
    return trimmed;
  }
}

/* ── Component ──────────────────────────────────────────────────────── */

export default function AbsenPage() {
  const { getHeaders, clearSession } = useSession();
  const [mode, setMode] = useState<"scan" | "manual">("manual");
  const [manualToken, setManualToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const scannerRef = useRef<{ stop: () => Promise<void> } | null>(null);
  const [scanning, setScanning] = useState(false);

  // Background token state
  const [liveToken, setLiveToken] = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState(true);
  const [tokenCountdown, setTokenCountdown] = useState(FALLBACK_COUNTDOWN);

  // User identity
  const [userName, setUserName] = useState<string | null>(null);

  // Shift warning modal state
  const [warningModal, setWarningModal] = useState<{
    open: boolean;
    title: string;
    message: string;
    detail?: string;
    pendingToken: string;
  }>({ open: false, title: "", message: "", pendingToken: "" });

  // Load user name from localStorage, or fetch from history API
  useEffect(() => {
    const stored = window.localStorage.getItem(USER_NAME_KEY);
    if (stored) {
      setUserName(stored);
      return;
    }
    // Fetch name from history API
    const fetchName = async () => {
      try {
        const res = await fetch("/api/history", { headers: getHeaders() });
        if (!res.ok) return;
        const json = await res.json();
        const name = json.summaryProfile?.name;
        if (name && typeof name === "string" && name.trim()) {
          const trimmed = name.trim();
          window.localStorage.setItem(USER_NAME_KEY, trimmed);
          setUserName(trimmed);
        }
      } catch {
        // silently fail
      }
    };
    fetchName();
  }, [getHeaders]);

  // Fetch latest token from /api/token
  const fetchToken = useCallback(async () => {
    setTokenLoading(true);
    try {
      const res = await fetch("/api/token");
      const json = await res.json();
      if (res.ok && json.token) {
        setLiveToken(json.token);
        if (json.expired_at) {
          const diff = Math.max(
            1,
            Math.round((new Date(json.expired_at).getTime() - Date.now()) / 1000)
          );
          setTokenCountdown(diff > 0 && diff < 120 ? diff : FALLBACK_COUNTDOWN);
        } else {
          setTokenCountdown(FALLBACK_COUNTDOWN);
        }
      }
    } catch {
      // silently fail, keep previous token
    } finally {
      setTokenLoading(false);
    }
  }, []);

  // Auto-refresh token in background
  useEffect(() => {
    fetchToken();
  }, [fetchToken]);

  useEffect(() => {
    if (tokenLoading) return;
    const interval = setInterval(() => {
      setTokenCountdown((prev) => {
        if (prev <= 1) {
          fetchToken();
          return FALLBACK_COUNTDOWN;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [tokenLoading, fetchToken]);

  // "Ambil Token" handler — fill input with live token
  const handleFetchAndFill = useCallback(() => {
    if (liveToken) {
      setManualToken(liveToken);
    }
  }, [liveToken]);

  const submitToken = useCallback(
    async (token: string) => {
      const t = extractTokenFromDecoded(token);
      if (!t) {
        setMessage({ type: "error", text: "Token tidak boleh kosong." });
        return;
      }
      setSubmitting(true);
      setMessage(null);
      try {
        const res = await fetch("/api/absen", {
          method: "POST",
          headers: getHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ token: t }),
        });
        const json = await res.json();
        if (res.status === 401) {
          clearSession();
          return;
        }
        if (!res.ok) {
          setMessage({
            type: "error",
            text: json?.error ?? "Gagal mengirim presensi.",
          });
          return;
        }
        setMessage({
          type: "success",
          text: json?.message ?? "Presensi berhasil dicatat.",
        });
        setManualToken("");
      } catch {
        setMessage({ type: "error", text: "Gagal mengirim presensi." });
      } finally {
        setSubmitting(false);
      }
    },
    [getHeaders, clearSession]
  );

  // Submit with shift check
  const submitWithShiftCheck = useCallback(
    (token: string) => {
      const warning = checkShiftWarning(userName);
      if (warning) {
        setWarningModal({
          open: true,
          title: warning.title,
          message: warning.message,
          detail: warning.detail,
          pendingToken: token,
        });
      } else {
        submitToken(token);
      }
    },
    [userName, submitToken]
  );

  const handleWarningConfirm = useCallback(() => {
    const token = warningModal.pendingToken;
    setWarningModal((m) => ({ ...m, open: false }));
    submitToken(token);
  }, [warningModal.pendingToken, submitToken]);

  const handleWarningCancel = useCallback(() => {
    setWarningModal((m) => ({ ...m, open: false }));
  }, []);

  const startScanner = useCallback(() => {
    if (scanning) return;
    const el = document.getElementById(SCANNER_ID);
    if (!el) return;
    import("html5-qrcode").then(({ Html5Qrcode }) => {
      const html5QrCode = new Html5Qrcode(SCANNER_ID);
      scannerRef.current = html5QrCode;
      setScanning(true);
      html5QrCode
        .start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decodedText) => {
            const token = extractTokenFromDecoded(decodedText);
            html5QrCode
              .stop()
              .catch(() => {})
              .finally(() => {
                setScanning(false);
                scannerRef.current = null;
                submitWithShiftCheck(token);
              });
          },
          () => {}
        )
        .catch((err: Error) => {
          setScanning(false);
          scannerRef.current = null;
          setMessage({
            type: "error",
            text: "Kamera tidak dapat diakses: " + (err?.message ?? "Unknown"),
          });
        });
    });
  }, [scanning, submitWithShiftCheck]);

  useEffect(() => {
    window.__smartpresStopScanner = (onDone) => {
      safeStopScanner(scannerRef, onDone);
    };
    return () => {
      window.__smartpresStopScanner = undefined;
      safeStopScanner(scannerRef);
    };
  }, []);

  useEffect(() => {
    if (mode !== "scan") return;
    const timer = setTimeout(() => startScanner(), 200);
    return () => clearTimeout(timer);
  }, [mode, startScanner]);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Presensi
      </h1>
      <p className="mb-5 text-sm text-zinc-600 dark:text-zinc-400">
        Scan QR code presensi atau masukkan token secara manual.
      </p>

      {/* ── User identity banner ── */}
      {userName && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-3 dark:border-blue-900/40 dark:bg-blue-950/30">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/50">
            <svg
              className="h-5 w-5 text-blue-600 dark:text-blue-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.8}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
              />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
              Masuk sebagai
            </p>
            <p className="truncate text-sm font-semibold text-blue-900 dark:text-blue-100">
              {userName}
            </p>
          </div>
        </div>
      )}

      {message && (
        <Alert type={message.type} className="mb-4">
          {message.text}
        </Alert>
      )}

      <div className="mb-5 flex gap-2">
        <button
          type="button"
          onClick={() => {
            safeStopScanner(scannerRef);
            setScanning(false);
            setMode("manual");
          }}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            mode === "manual"
              ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
              : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          }`}
        >
          Manual
        </button>
        <button
          type="button"
          onClick={() => setMode("scan")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            mode === "scan"
              ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
              : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          }`}
        >
          Scan QR
        </button>
      </div>

      {mode === "scan" && (
        <section className="mb-6 rounded-xl border border-zinc-200 bg-white p-4 sm:p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Scan QR Code
          </h2>
          <div
            id={SCANNER_ID}
            className="min-h-[240px] w-full max-w-sm overflow-hidden rounded-lg bg-zinc-900"
          />
          {!scanning && (
            <div className="mt-3">
              <button
                type="button"
                onClick={startScanner}
                className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 sm:w-auto dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Nyalakan kamera
              </button>
            </div>
          )}
        </section>
      )}

      {mode === "manual" && (
        <section className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Masukkan token
          </h2>
          <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
            Klik &quot;Ambil Token&quot; untuk mengisi token QR terbaru secara otomatis, lalu kirim.
          </p>

          {/* Token label + countdown */}
          <label
            htmlFor="manual-token"
            className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Token
            {liveToken && (
              <span className="ml-2 font-normal text-xs text-zinc-400 dark:text-zinc-500">
                refresh in {tokenCountdown}s
              </span>
            )}
          </label>

          {/* Token input + Ambil Token */}
          <div className="mb-3 flex gap-2">
            <input
              id="manual-token"
              type="text"
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              placeholder="Token akan terisi otomatis…"
              className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder-zinc-500"
            />
            <button
              type="button"
              onClick={handleFetchAndFill}
              disabled={!liveToken || tokenLoading}
              className="shrink-0 rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 sm:px-4 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              {tokenLoading ? "Memuat…" : "Ambil Token"}
            </button>
          </div>

          {/* Submit button — full width on mobile */}
          <button
            type="button"
            onClick={() => submitWithShiftCheck(manualToken)}
            disabled={submitting}
            className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 sm:w-auto dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {submitting ? "Mengirim…" : "Kirim presensi"}
          </button>
        </section>
      )}

      {/* Shift warning modal */}
      <ShiftWarningModal
        open={warningModal.open}
        title={warningModal.title}
        message={warningModal.message}
        detail={warningModal.detail}
        onConfirm={handleWarningConfirm}
        onCancel={handleWarningCancel}
      />
    </div>
  );
}
