import { NextResponse } from "next/server";
import { extractSessionCookie } from "./cloudlab/cookies";

// ─── Standard API response helpers ──────────────────────────────────────────

export function successJson(data: object, status = 200) {
  return NextResponse.json({ success: true, ...data }, { status });
}

export function errorJson(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

// ─── Auth guard ──────────────────────────────────────────────────────────────

/**
 * Extracts and validates the session cookie from the request.
 * Returns a tuple: `[cookie, errorResponse]`.
 * If errorResponse is non-null, return it immediately from the handler.
 */
export function requireSession(
  request: Request,
): [string, null] | [null, Response] {
  const cookie = extractSessionCookie(request);
  if (!cookie) {
    return [null, errorJson("Session required", 401)];
  }
  return [cookie, null];
}

// ─── Catch-all error wrapper ─────────────────────────────────────────────────

type RouteHandler = (request: Request) => Promise<Response>;

/**
 * Wraps an API route handler with consistent error handling.
 * Catches unhandled exceptions and returns a clean 500 response.
 */
export function withErrorHandler(handler: RouteHandler): RouteHandler {
  return async (request: Request) => {
    try {
      return await handler(request);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unexpected error";
      console.error(`[API Error] ${request.url}:`, message);
      return errorJson(message, 500);
    }
  };
}
