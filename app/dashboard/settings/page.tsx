"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SettingsPage() {
  const router = useRouter();
  const [autoPresensi, setAutoPresensi] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [whatsappNotifOn, setWhatsappNotifOn] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [passwordSectionOpen, setPasswordSectionOpen] = useState(false);

  function validateNewPassword(password: string): string | null {
    if (password.length < 8) return "Minimal 8 karakter.";
    if (!/[A-Z]/.test(password)) return "Minimal 1 huruf besar (A-Z).";
    if (!/[a-z]/.test(password)) return "Minimal 1 huruf kecil (a-z).";
    if (!/[0-9]/.test(password)) return "Minimal 1 angka (0-9).";
    if (!/[!@#$%^&*]/.test(password)) return "Minimal 1 karakter khusus (!@#$%^&*).";
    return null;
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!newPassword || newPassword !== confirmPassword) {
      setPasswordMessage({ type: "error", text: "Kata sandi baru dan konfirmasi harus sama." });
      return;
    }
    const passwordError = validateNewPassword(newPassword);
    if (passwordError) {
      setPasswordMessage({ type: "error", text: passwordError });
      return;
    }
    if (typeof window === "undefined") return;
    const sessionCookie = window.localStorage.getItem("sessionCookie");
    const sessionId = window.localStorage.getItem("sessionId");
    if (!sessionCookie && !sessionId) {
      setPasswordMessage({ type: "error", text: "Sesi tidak ditemukan. Silakan login lagi." });
      router.replace("/login");
      return;
    }
    setPasswordLoading(true);
    setPasswordMessage(null);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (sessionCookie) headers["X-Session-Cookie"] = sessionCookie;
      else if (sessionId) headers["X-Session-Id"] = sessionId;
      const res = await fetch("/api/change-password", {
        method: "POST",
        headers,
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });
      const json = await res.json();
      if (res.status === 401) {
        window.localStorage.removeItem("sessionId");
        window.localStorage.removeItem("sessionCookie");
        router.replace("/login");
        return;
      }
      if (!res.ok) {
        setPasswordMessage({ type: "error", text: json?.error ?? "Gagal mengubah kata sandi." });
        return;
      }
      setPasswordMessage({ type: "success", text: json?.message ?? "Kata sandi berhasil diubah." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setPasswordMessage({ type: "error", text: "Gagal mengubah kata sandi." });
    } finally {
      setPasswordLoading(false);
    }
  }

  function handleLogout() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("sessionId");
      window.localStorage.removeItem("sessionCookie");
    }
    router.replace("/login");
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Settings
      </h1>
      <p className="mb-6 text-zinc-600 dark:text-zinc-400">
        Kelola pengaturan akun.
      </p>

      <section className="mb-6 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-3 text-lg font-medium text-zinc-900 dark:text-zinc-50">
          Auto Presensi
        </h2>
        <label className="flex cursor-pointer items-center justify-between gap-4">
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            Presensi otomatis sesuai jadwal
          </span>
          <span
            className={`relative inline-block h-5 w-9 shrink-0 rounded-full transition-colors ${
              autoPresensi ? "bg-green-500 dark:bg-green-600" : "bg-zinc-300 dark:bg-zinc-600"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                autoPresensi ? "translate-x-4" : "translate-x-0"
              }`}
            />
            <input
              type="checkbox"
              checked={autoPresensi}
              onChange={(e) => setAutoPresensi(e.target.checked)}
              className="sr-only"
            />
          </span>
        </label>
      </section>

      {autoPresensi && (
        <section className="mb-6 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-lg font-medium text-zinc-900 dark:text-zinc-50">
            Notifikasi WhatsApp
          </h2>
          <label className="mb-4 flex cursor-pointer items-center justify-between gap-4">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              Terima notifikasi presensi
            </span>
            <span
              className={`relative inline-block h-5 w-9 shrink-0 rounded-full transition-colors ${
                whatsappNotifOn ? "bg-green-500 dark:bg-green-600" : "bg-zinc-300 dark:bg-zinc-600"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  whatsappNotifOn ? "translate-x-4" : "translate-x-0"
                }`}
              />
              <input
                type="checkbox"
                checked={whatsappNotifOn}
                onChange={(e) => setWhatsappNotifOn(e.target.checked)}
                className="sr-only"
              />
            </span>
          </label>
          {whatsappNotifOn && (
            <div>
              <label htmlFor="whatsapp-number" className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Nomor WhatsApp
              </label>
              <div className="flex max-w-xs overflow-hidden rounded-lg border border-zinc-300 bg-white focus-within:ring-2 focus-within:ring-zinc-400 focus-within:ring-offset-0 dark:border-zinc-600 dark:bg-zinc-800 dark:focus-within:ring-zinc-500">
                <span className="flex items-center border-r border-zinc-300 bg-zinc-50 px-3 py-2.5 text-sm font-medium text-zinc-600 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                  +62
                </span>
                <input
                  id="whatsapp-number"
                  type="tel"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value.replace(/\D/g, "").slice(0, 12))}
                  placeholder="81234567890"
                  className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-0 dark:text-zinc-50 dark:placeholder-zinc-500"
                />
              </div>
            </div>
          )}
        </section>
      )}

      <section className="mb-6 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <button
          type="button"
          onClick={() => setPasswordSectionOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-3 p-5 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
        >
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
            Ubah kata sandi
          </h2>
          <svg
            className={`h-5 w-5 shrink-0 text-zinc-500 transition-transform dark:text-zinc-400 ${passwordSectionOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {passwordSectionOpen && (
          <div className="border-t border-zinc-200 px-5 pb-5 pt-1 dark:border-zinc-800">
            <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
              Gunakan kata sandi CloudLab saat ini, lalu masukkan kata sandi baru.
            </p>
            {passwordMessage && (
              <div
                className={`mb-4 rounded-lg border p-3 text-sm ${
                  passwordMessage.type === "success"
                    ? "border-green-200 bg-green-50 text-green-800 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-200"
                    : "border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200"
                }`}
              >
                {passwordMessage.text}
              </div>
            )}
            <form onSubmit={handleChangePassword} className="flex flex-col gap-4 max-w-md">
              <div>
                <label htmlFor="current-password" className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Kata sandi saat ini
                </label>
                <input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
                />
              </div>
              <div>
                <label htmlFor="new-password" className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Kata sandi baru
                </label>
                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
                />
                <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                  Minimal 8 karakter, 1 huruf besar (A-Z), 1 huruf kecil (a-z), 1 angka (0-9), 1 karakter khusus (!@#$%^&*).
                </p>
              </div>
              <div>
                <label htmlFor="confirm-password" className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Konfirmasi kata sandi baru
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
                />
              </div>
              <button
                type="submit"
                disabled={passwordLoading}
                className="w-fit rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {passwordLoading ? "Mengubah…" : "Ubah kata sandi"}
              </button>
            </form>
          </div>
        )}
      </section>

      <section className="mt-8 pt-6 border-t border-zinc-200 dark:border-zinc-800">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50"
        >
          <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Keluar
        </button>
      </section>
    </div>
  );
}
