"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const menu = [
  { href: "/dashboard", label: "Dashboard", shortLabel: "Dashboard", icon: "dashboard" },
  { href: "/dashboard/absen", label: "Absen", shortLabel: "Absen", icon: "absen" },
  { href: "/dashboard/presensi-display", label: "Presensi Display", shortLabel: "Display", icon: "display" },
  { href: "/dashboard/history", label: "History", shortLabel: "History", icon: "history" },
  { href: "/dashboard/settings", label: "Settings", shortLabel: "Set", icon: "settings" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  const TabIcon = ({ name, active }: { name: string; active: boolean }) => {
    const cls = active ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-500 dark:text-zinc-400";
    switch (name) {
      case "dashboard":
        return (
          <svg className={`h-5 w-5 ${cls}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
        );
      case "absen":
        return (
          <svg className={`h-5 w-5 ${cls}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        );
      case "history":
        return (
          <svg className={`h-5 w-5 ${cls}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case "user":
        return (
          <svg className={`h-5 w-5 ${cls}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        );
      case "settings":
        return (
          <svg className={`h-5 w-5 ${cls}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        );
      case "display":
        return (
          <svg className={`h-5 w-5 ${cls}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        );
      default:
        return null;
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sessionId = window.localStorage.getItem("sessionId");
    const sessionCookie = window.localStorage.getItem("sessionCookie");
    if (!sessionId && !sessionCookie) {
      router.replace("/login");
      return;
    }
    setAllowed(true);
  }, [router]);

  if (allowed === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-100 dark:bg-zinc-950">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Memeriksa login…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-zinc-100 dark:bg-zinc-950">
      {/* Sidebar: desktop only */}
      <aside className="hidden w-56 shrink-0 border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 lg:block">
        <div className="sticky top-0 flex h-full flex-col gap-1 p-4">
          <Link
            href="/dashboard"
            className="mb-2 px-3 py-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50"
          >
            Dashboard
          </Link>
          <nav className="flex flex-col gap-0.5">
            {menu.map(({ href, label }) => {
              const active = pathname === href;
              const isLeavingAbsen = pathname === "/dashboard/absen" && href !== "/dashboard/absen";
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={(e) => {
                    if (isLeavingAbsen && typeof window !== "undefined" && window.__smartpresStopScanner) {
                      e.preventDefault();
                      window.__smartpresStopScanner(() => router.push(href));
                    }
                  }}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      <main className="flex-1 overflow-auto p-4 pb-24 lg:pb-6 lg:p-6">
        {children}
      </main>

      {/* Bottom tab bar: mobile/tablet only */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-zinc-200 bg-white/95 py-2 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-zinc-800 dark:bg-zinc-900/95 supports-[backdrop-filter]:dark:bg-zinc-900/80 lg:hidden">
        {menu.map(({ href, shortLabel, icon }) => {
          const active = pathname === href;
          const isLeavingAbsen = pathname === "/dashboard/absen" && href !== "/dashboard/absen";
          return (
            <Link
              key={href}
              href={href}
              onClick={(e) => {
                if (isLeavingAbsen && typeof window !== "undefined" && window.__smartpresStopScanner) {
                  e.preventDefault();
                  window.__smartpresStopScanner(() => router.push(href));
                }
              }}
              className={`flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 transition-colors ${
                active
                  ? "text-zinc-900 dark:text-zinc-50"
                  : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              <TabIcon name={icon} active={active} />
              <span className="text-xs font-medium">{shortLabel}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
