import {
  CLOUDLAB_URLS,
  BROWSER_HEADERS,
  collectCookies,
  getCookieValue,
} from "@/lib/cloudlab";
import { errorJson, withErrorHandler } from "@/lib/api-utils";

async function handleLogin(request: Request): Promise<Response> {
  const { email, password } = await request.json();
  if (!email || !password) {
    return errorJson("Email dan password wajib diisi.", 400);
  }

  const cookieParts: string[] = [];

  const preRes = await fetch(CLOUDLAB_URLS.login, {
    method: "GET",
    headers: BROWSER_HEADERS,
    cache: "no-store",
    redirect: "manual",
  });
  await preRes.text();
  collectCookies(preRes, cookieParts);

  const formData = new URLSearchParams({ email, password });
  const loginRes = await fetch(CLOUDLAB_URLS.login, {
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

  const isError =
    rawBody.includes("alert-error") ||
    rawBody.includes("Email atau password salah!");

  if (!isError && (loginRes.status === 301 || loginRes.status === 302)) {
    const location = loginRes.headers.get("location");
    if (location) {
      const redirectUrl = location.startsWith("http")
        ? location
        : new URL(location, CLOUDLAB_URLS.login).toString();

      const dashRes = await fetch(redirectUrl, {
        method: "GET",
        headers: {
          ...BROWSER_HEADERS,
          referer: CLOUDLAB_URLS.login,
          cookie: cookieParts.join("; "),
        },
        cache: "no-store",
        redirect: "manual",
      });
      await dashRes.text();
      collectCookies(dashRes, cookieParts);
    }
  }

  if (isError) {
    return Response.json(
      { success: false, message: "Email atau password salah!" },
      { status: 200 },
    );
  }

  const sessionCookie = cookieParts.length
    ? cookieParts.join("; ")
    : null;
  const sessionId =
    getCookieValue(cookieParts, "PHPSESSID") ??
    getCookieValue(cookieParts, "remember_me");

  return Response.json({
    success: true,
    ...(sessionId && { sessionId }),
    ...(sessionCookie && { sessionCookie }),
  });
}

export const POST = withErrorHandler(handleLogin);
