"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const sessionId = window.localStorage.getItem("sessionId");
    const sessionCookie = window.localStorage.getItem("sessionCookie");
    if (sessionId || sessionCookie) {
      router.replace("/dashboard");
    } else {
      router.replace("/login");
    }
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-100 dark:bg-zinc-950">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">Memuat…</p>
    </div>
  );
}
