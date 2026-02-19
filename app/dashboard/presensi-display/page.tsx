"use client";

import { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

const COUNTDOWN_SECONDS = 15;

function generateToken(): string {
  return `PRESENSI-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const DUMMY_PRESENSI: { nama: string; waktu: string; status: string }[] = [
  { nama: "Ahmad Rizki", waktu: "07:45", status: "Hadir" },
  { nama: "Budi Santoso", waktu: "07:52", status: "Hadir" },
  { nama: "Citra Dewi", waktu: "08:01", status: "Terlambat" },
  { nama: "Dian Permata", waktu: "07:48", status: "Hadir" },
  { nama: "Eko Prasetyo", waktu: "08:15", status: "Terlambat" },
  { nama: "Fitri Handayani", waktu: "07:55", status: "Hadir" },
  { nama: "Gilang Ramadhan", waktu: "07:42", status: "Hadir" },
  { nama: "Hesti Wijaya", waktu: "08:03", status: "Terlambat" },
  { nama: "Indra Kusuma", waktu: "07:58", status: "Hadir" },
  { nama: "Joko Susilo", waktu: "07:50", status: "Hadir" },
];

export default function PresensiDisplayPage() {
  const [token, setToken] = useState(() => generateToken());
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setToken(generateToken());
          return COUNTDOWN_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleCopyToken = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(token);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      setCopySuccess(false);
    }
  }, [token]);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Presensi Display
      </h1>
      <p className="mb-6 text-zinc-600 dark:text-zinc-400">
        Tampilan QR presensi dan daftar presensi (data dummy).
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            QR Presensi
          </h2>
          <div className="flex flex-col items-center gap-4">
            <div className="rounded-xl border-2 border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-white">
              <QRCodeSVG
                value={token}
                size={220}
                level="M"
                bgColor="#ffffff"
                fgColor="#18181b"
                includeMargin={false}
              />
            </div>
            <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
              QR diperbarui setiap {COUNTDOWN_SECONDS} detik
            </p>
            <div className="flex items-center gap-2 rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              <span className="font-mono text-xs">{countdown}s</span>
              <span>sampai QR berikutnya</span>
            </div>
            <div className="w-full max-w-sm space-y-2">
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Token
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={token}
                  className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 font-mono text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
                />
                <button
                  type="button"
                  onClick={handleCopyToken}
                  className="shrink-0 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  {copySuccess ? "Tersalin" : "Salin"}
                </button>
              </div>
            </div>
            <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
              Scan QR code atau salin token untuk presensi
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="border-b border-zinc-200 px-6 py-4 text-sm font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            Daftar Presensi
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[320px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50">
                  <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">
                    No
                  </th>
                  <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">
                    Nama
                  </th>
                  <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">
                    Waktu
                  </th>
                  <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {DUMMY_PRESENSI.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-zinc-100 last:border-0 dark:border-zinc-800"
                  >
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {i + 1}
                    </td>
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">
                      {row.nama}
                    </td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                      {row.waktu}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          row.status === "Hadir"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
