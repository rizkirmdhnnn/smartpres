import { resolveSessionCookie, unauthorizedResponse } from "@/app/lib/session";
import {
  CLOUDLAB_BASE,
  BROWSER_HEADERS,
  isCloudLabLoginPage,
  isRedirectToLogin,
} from "@/app/lib/cloudlab";
import { validateNewPassword } from "@/app/lib/validation";

const CLOUDLAB_CHANGE_PASSWORD_URL = `${CLOUDLAB_BASE}/change_password.php`;

function buildFormBody(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

export async function POST(request: Request) {
  try {
    const cookie = resolveSessionCookie(request);
    if (!cookie) return unauthorizedResponse("Session required");

    const body = await request.json();
    const currentPassword =
      typeof body?.current_password === "string" ? body.current_password : "";
    const newPassword =
      typeof body?.new_password === "string" ? body.new_password : "";
    const confirmPassword =
      typeof body?.confirm_password === "string" ? body.confirm_password : "";

    if (!currentPassword || !newPassword || !confirmPassword) {
      return Response.json(
        {
          error:
            "current_password, new_password, dan confirm_password wajib diisi.",
        },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return Response.json(
        { error: "Kata sandi baru dan konfirmasi tidak sama." },
        { status: 400 }
      );
    }

    const passwordError = validateNewPassword(newPassword);
    if (passwordError) {
      return Response.json({ error: passwordError }, { status: 400 });
    }

    const formBody = buildFormBody({
      current_password: currentPassword,
      new_password: newPassword,
      confirm_password: confirmPassword,
    });

    const res = await fetch(CLOUDLAB_CHANGE_PASSWORD_URL, {
      method: "POST",
      headers: {
        ...BROWSER_HEADERS,
        "content-type": "application/x-www-form-urlencoded",
        origin: CLOUDLAB_BASE,
        referer: CLOUDLAB_CHANGE_PASSWORD_URL,
        cookie,
      },
      body: formBody,
      cache: "no-store",
      redirect: "manual",
    });

    const html = await res.text();

    if (isRedirectToLogin(res)) return unauthorizedResponse();
    if (isCloudLabLoginPage(html)) return unauthorizedResponse();

    const isError =
      /password salah|kata sandi salah|wrong password|invalid password/i.test(
        html
      ) ||
      (/gagal|failed|error/i.test(html) && !/berhasil|success/i.test(html));
    const isSuccess =
      /berhasil|success|password telah|kata sandi telah|diubah/i.test(html) ||
      (!isError && res.ok);

    if (isSuccess && !isError) {
      return Response.json({
        success: true,
        message: "Kata sandi berhasil diubah.",
      });
    }

    const errorMatch = html.match(
      /<div[^>]*class="[^"]*alert[^"]*"[^>]*>([\s\S]*?)<\/div>/i
    );
    const errorMsg = errorMatch
      ? errorMatch[1]
          .replace(/<[^>]+>/g, "")
          .replace(/\s+/g, " ")
          .trim()
      : "Kata sandi gagal diubah. Periksa kata sandi lama.";
    return Response.json(
      { error: errorMsg || "Kata sandi gagal diubah." },
      { status: 400 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return Response.json({ error: message }, { status: 500 });
  }
}
