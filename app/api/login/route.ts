const CLOUDLAB_LOGIN_URL = "https://cloudlab.amikom.ac.id/login.php";

const BROWSER_HEADERS = {
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
  referer: "https://cloudlab.amikom.ac.id/login.php",
};

function getSetCookieHeaders(r: Response): string[] {
  if ("getSetCookie" in r.headers && typeof (r.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie === "function") {
    return (r.headers as Headers & { getSetCookie: () => string[] }).getSetCookie();
  }
  const one = r.headers.get("set-cookie");
  return one ? [one] : [];
}

function collectCookies(r: Response, parts: string[]): void {
  for (const setCookie of getSetCookieHeaders(r)) {
    const m = setCookie.match(/^([^=]+)=([^;]+)/);
    if (m) {
      const name = m[1].trim();
      const value = m[2].trim();
      const idx = parts.findIndex((p) => p.startsWith(name + "="));
      if (idx >= 0) parts[idx] = `${name}=${value}`;
      else parts.push(`${name}=${value}`);
    }
  }
}

function getCookieValue(parts: string[], name: string): string | null {
  const entry = parts.find((p) => p.startsWith(name + "="));
  return entry ? entry.slice(name.length + 1) : null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = body?.email ?? "";
    const password = body?.password ?? "";
    const cookieParts: string[] = [];

    // Step 1: GET login.php to obtain PHPSESSID (like a browser loading the page)
    const preRes = await fetch(CLOUDLAB_LOGIN_URL, {
      method: "GET",
      headers: BROWSER_HEADERS,
      cache: "no-store",
      redirect: "manual",
    });
    await preRes.text();
    collectCookies(preRes, cookieParts);

    console.log("[login] Step 1 (GET login.php):", {
      status: preRes.status,
      cookies: cookieParts,
    });

    // Step 2: POST login.php with PHPSESSID + form data
    const formData = new URLSearchParams();
    formData.append("email", email);
    formData.append("password", password);

    const loginRes = await fetch(CLOUDLAB_LOGIN_URL, {
      method: "POST",
      headers: {
        ...BROWSER_HEADERS,
        "Content-Type": "application/x-www-form-urlencoded",
        cookie: cookieParts.join("; "),
      },
      body: formData.toString(),
      cache: "no-store",
      redirect: "manual",
    });

    const rawBody = await loginRes.text();
    collectCookies(loginRes, cookieParts);

    console.log("[login] Step 2 (POST login.php):", {
      status: loginRes.status,
      cookies: cookieParts,
      bodySnippet: rawBody.slice(0, 300),
    });

    const isError = rawBody.includes("alert-error") || rawBody.includes("Email atau password salah!");

    // Step 3: Follow redirect to dashboard.php (if 302) with all cookies
    if (!isError && (loginRes.status === 301 || loginRes.status === 302)) {
      const location = loginRes.headers.get("location");
      if (location) {
        const redirectUrl = location.startsWith("http") ? location : new URL(location, CLOUDLAB_LOGIN_URL).toString();
        const dashRes = await fetch(redirectUrl, {
          method: "GET",
          headers: {
            ...BROWSER_HEADERS,
            referer: CLOUDLAB_LOGIN_URL,
            cookie: cookieParts.join("; "),
          },
          cache: "no-store",
          redirect: "manual",
        });
        await dashRes.text();
        collectCookies(dashRes, cookieParts);

        console.log("[login] Step 3 (GET dashboard.php):", {
          status: dashRes.status,
          cookies: cookieParts,
        });
      }
    }

    const sessionCookie = cookieParts.length ? cookieParts.join("; ") : null;
    const sessionId = getCookieValue(cookieParts, "PHPSESSID") ?? getCookieValue(cookieParts, "remember_me");

    const data = {
      success: !isError,
      ...(isError && { message: "Email atau password salah!" }),
      ...(sessionId && !isError && { sessionId }),
      ...(sessionCookie && !isError && { sessionCookie }),
    };
    return Response.json(data, { status: 200 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unexpected error during login";
    return Response.json({ error: message }, { status: 500 });
  }
}
