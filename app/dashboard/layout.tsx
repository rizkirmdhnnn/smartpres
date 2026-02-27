"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TabIcon } from "../components/Icons";

const menu = [
  { href: "/dashboard", label: "Dashboard", shortLabel: "Dashboard", icon: "dashboard" },
  { href: "/dashboard/absen", label: "Absen", shortLabel: "Absen", icon: "absen" },
  { href: "/dashboard/presensi-display", label: "Presensi Display", shortLabel: "Display", icon: "display" },
  { href: "/dashboard/history", label: "History", shortLabel: "History", icon: "history" },
  { href: "/dashboard/settings", label: "Settings", shortLabel: "Set", icon: "settings" },
];

declare global {
  interface Window {
    __smartpresStopScanner?: (onDone: () => void) => void;
  }
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    const sessionId = window.localStorage.getItem("sessionId");
    const sessionCookie = window.localStorage.getItem("sessionCookie");
    if (!sessionId && !sessionCookie) {
      router.replace("/login");
      return;
    }
    setAllowed(true);
  }, [router]);

  function handleNavClick(e: React.MouseEvent, href: string) {
    const isLeavingAbsen =
      pathname === "/dashboard/absen" && href !== "/dashboard/absen";
    if (isLeavingAbsen && window.__smartpresStopScanner) {
      e.preventDefault();
      window.__smartpresStopScanner(() => router.push(href));
    }
  }

  if (allowed === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-100 dark:bg-zinc-950">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Memeriksa login…
        </p>
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
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={(e) => handleNavClick(e, href)}
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
          return (
            <Link
              key={href}
              href={href}
              onClick={(e) => handleNavClick(e, href)}
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
