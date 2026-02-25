"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const SCANNER_ID = "qr-scanner-root";

type StopScannerCallback = () => void;

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
    scanner.stop().catch(() => {}).finally(done);
  } catch {
    done();
  }
}

declare global {
  interface Window {
    __smartpresStopScanner?: (onDone: () => void) => void;
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
  const router = useRouter();
  const [mode, setMode] = useState<"scan" | "manual">("scan");
  const [manualToken, setManualToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pasteError, setPasteError] = useState<string | null>(null);
  const scannerRef = useRef<{ stop: () => Promise<void> } | null>(null);
  const [scanning, setScanning] = useState(false);

  const handlePasteToken = useCallback(async () => {
    setPasteError(null);
    try {
      const text = await navigator.clipboard.readText();
      const extracted = extractTokenFromDecoded(text);
      if (extracted) setManualToken(extracted);
      else setPasteError("Clipboard kosong atau bukan teks.");
    } catch {
      setPasteError("Tidak dapat membaca clipboard. Izinkan akses atau tempel manual (Ctrl+V).");
    }
  }, []);

  const submitToken = useCallback(
    async (token: string) => {
      const t = extractTokenFromDecoded(token);
      if (!t) {
        setMessage({ type: "error", text: "Token tidak boleh kosong." });
        return;
      }
      if (typeof window === "undefined") return;
      const sessionCookie = window.localStorage.getItem("sessionCookie");
      const sessionId = window.localStorage.getItem("sessionId");
      if (!sessionCookie && !sessionId) {
        setMessage({ type: "error", text: "Sesi tidak ditemukan. Silakan login lagi." });
        router.replace("/login");
        return;
      }
      setSubmitting(true);
      setMessage(null);
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (sessionCookie) headers["X-Session-Cookie"] = sessionCookie;
        else if (sessionId) headers["X-Session-Id"] = sessionId;
        const res = await fetch("/api/absen", {
          method: "POST",
          headers,
          body: JSON.stringify({ token: t }),
        });
        const json = await res.json();
        if (res.status === 401) {
          window.localStorage.removeItem("sessionId");
          window.localStorage.removeItem("sessionCookie");
          router.replace("/login");
          return;
        }
        if (!res.ok) {
          setMessage({ type: "error", text: json?.error ?? "Gagal mengirim presensi." });
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
    [router]
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
            html5QrCode.stop().catch(() => {}).finally(() => {
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
          setMessage({ type: "error", text: "Kamera tidak dapat diakses: " + (err?.message ?? "Unknown") });
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
        <div
          className={`mb-4 rounded-xl border p-4 ${
            message.type === "success"
              ? "border-green-200 bg-green-50 text-green-800 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-200"
              : "border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200"
          }`}
        >
          <p className="text-sm font-medium">{message.text}</p>
        </div>
      )}

      <div className="mb-6 flex gap-2">
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
      </div>

      {mode === "scan" && (
        <section className="mb-6 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Scan QR Code
          </h2>
          <div id={SCANNER_ID} className="min-h-[240px] w-full max-w-sm overflow-hidden rounded-lg bg-zinc-900" />
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
            Tempel token dari QR presensi ke kolom di bawah, lalu kirim.
          </p>
          {pasteError && (
            <p className="mb-3 text-sm text-amber-600 dark:text-amber-400">{pasteError}</p>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <label htmlFor="manual-token" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Token
              </label>
              <div className="flex gap-2">
                <input
                  id="manual-token"
                  type="text"
                  value={manualToken}
                  onChange={(e) => { setManualToken(e.target.value); setPasteError(null); }}
                  onPaste={() => setPasteError(null)}
                  placeholder="Tempel token di sini (Ctrl+V atau tombol Tempel)"
                  className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder-zinc-500"
                />
                <button
                  type="button"
                  onClick={handlePasteToken}
                  className="shrink-0 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                >
                  Tempel
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
