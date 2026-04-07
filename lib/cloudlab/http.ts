import { BROWSER_HEADERS } from "./constants";
import { isLoginPage } from "./html-parser";

export interface CloudLabResponse {
  html: string;
  status: number;
  redirectLocation: string | null;
}

/**
 * Performs a fetch to CloudLab with browser-like headers and the user's
 * session cookie. Returns the raw HTML and metadata.
 */
export async function fetchCloudLab(
  url: string,
  options: {
    method?: "GET" | "POST";
    cookie: string;
    body?: string;
    contentType?: string;
    referer?: string;
  },
): Promise<CloudLabResponse> {
  const headers: Record<string, string> = {
    ...BROWSER_HEADERS,
    cookie: options.cookie,
  };

  if (options.referer) headers.referer = options.referer;
  if (options.contentType) headers["content-type"] = options.contentType;

  const res = await fetch(url, {
    method: options.method ?? "GET",
    headers,
    body: options.body,
    cache: "no-store",
    redirect: "manual",
  });

  const html = await res.text();
  const redirectLocation = res.headers.get("location");

  return { html, status: res.status, redirectLocation };
}

/**
 * Validates a CloudLab response, returning an error Response if the session
 * has expired or the upstream returned an error. Returns `null` if valid.
 */
export function validateCloudLabResponse(
  { html, status, redirectLocation }: CloudLabResponse,
  context: string,
): Response | null {
  if (status === 301 || status === 302) {
    if (redirectLocation?.toLowerCase().includes("login")) {
      return Response.json(
        { error: "Sesi tidak valid. Silakan login lagi." },
        { status: 401 },
      );
    }
  }

  if (isLoginPage(html)) {
    return Response.json(
      { error: "Sesi tidak valid. Silakan login lagi." },
      { status: 401 },
    );
  }

  if (status >= 400 && status !== 301 && status !== 302) {
    return Response.json(
      { error: `Failed to fetch ${context}`, upstreamStatus: status },
      { status: 502 },
    );
  }

  return null;
}
