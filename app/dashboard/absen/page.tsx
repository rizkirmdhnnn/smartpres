"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "@/app/hooks/useSession";
import { Alert } from "@/app/components/Alert";

const SCANNER_ID = "qr-scanner-root";
const FALLBACK_COUNTDOWN = 15;

type StopScannerCallback = () => void;

declare global {
  interface Window {
    __smartpresStopScanner?: (onDone: () => void) => void;
  }
}

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
                submitToken(token);
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
  }, [scanning, submitToken]);

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
      <h1 className="mb-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Absen
      </h1>
      <p className="mb-6 text-zinc-600 dark:text-zinc-400">
        Scan QR code presensi atau masukkan token secara manual.
      </p>

      {message && (
        <Alert type={message.type} className="mb-4">
          {message.text}
        </Alert>
      )}

      <div className="mb-6 flex gap-2">
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
        <section className="mb-6 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
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
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Nyalakan kamera
              </button>
            </div>
          )}
        </section>
      )}

      {mode === "manual" && (
        <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Masukkan token
          </h2>
          <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
            Klik &quot;Ambil Token&quot; untuk mengisi token QR terbaru secara otomatis, lalu kirim.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <label
                htmlFor="manual-token"
                className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Token
                {liveToken && (
                  <span className="ml-2 font-normal text-xs text-zinc-400 dark:text-zinc-500">
                    refresh in {tokenCountdown}s
                  </span>
                )}
              </label>
              <div className="flex gap-2">
                <input
                  id="manual-token"
                  type="text"
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  placeholder="Token akan terisi otomatis…"
                  className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder-zinc-500"
                />
                <button
                  type="button"
                  onClick={handleFetchAndFill}
                  disabled={!liveToken || tokenLoading}
                  className="shrink-0 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                >
                  {tokenLoading ? "Memuat…" : "Ambil Token"}
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => submitToken(manualToken)}
              disabled={submitting}
              className="shrink-0 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {submitting ? "Mengirim…" : "Kirim presensi"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
