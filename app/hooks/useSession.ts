"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";

const SESSION_KEYS = ["sessionId", "sessionCookie"] as const;

/**
 * Custom hook for session management across all pages.
 * Provides auth checking, header building, and session clearing.
 */
export function useSession() {
  const router = useRouter();

  /** Whether a session exists in localStorage. */
  const isAuthenticated = useMemo(() => {
    if (typeof window === "undefined") return false;
    return SESSION_KEYS.some((key) => !!window.localStorage.getItem(key));
  }, []);

  /** Get the sessionId from localStorage. */
  const sessionId =
    typeof window !== "undefined"
      ? window.localStorage.getItem("sessionId")
      : null;

  /** Get the sessionCookie from localStorage. */
  const sessionCookie =
    typeof window !== "undefined"
      ? window.localStorage.getItem("sessionCookie")
      : null;

  /** Build the headers object for API requests. */
  const getHeaders = useCallback(
    (extra?: Record<string, string>): Record<string, string> => {
      const headers: Record<string, string> = { ...extra };
      if (sessionCookie) headers["X-Session-Cookie"] = sessionCookie;
      else if (sessionId) headers["X-Session-Id"] = sessionId;
      return headers;
    },
    [sessionCookie, sessionId]
  );

  /** Clear all session data and redirect to login. */
  const clearSession = useCallback(() => {
    if (typeof window !== "undefined") {
      SESSION_KEYS.forEach((key) => window.localStorage.removeItem(key));
    }
    router.replace("/login");
  }, [router]);

  /** Save session data from login response. */
  const saveSession = useCallback(
    (data: { sessionId?: string; sessionCookie?: string }) => {
      if (typeof window === "undefined") return;
      if (typeof data.sessionId === "string")
        window.localStorage.setItem("sessionId", data.sessionId);
      if (typeof data.sessionCookie === "string")
        window.localStorage.setItem("sessionCookie", data.sessionCookie);
    },
    []
  );

  /** Redirect to login if not authenticated. Returns true if redirect happened. */
  const requireAuth = useCallback((): boolean => {
    if (!sessionId && !sessionCookie) {
      router.replace("/login");
      return true;
    }
    return false;
  }, [sessionId, sessionCookie, router]);

  return {
    isAuthenticated,
    sessionId,
    sessionCookie,
    getHeaders,
    clearSession,
    saveSession,
    requireAuth,
    router,
  };
}
