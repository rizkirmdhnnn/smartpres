const CLOUDLAB_CHANGE_PASSWORD_URL = "https://cloudlab.amikom.ac.id/change_password.php";

const BROWSER_HEADERS = {
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
  "content-type": "application/x-www-form-urlencoded",
  origin: "https://cloudlab.amikom.ac.id",
  referer: "https://cloudlab.amikom.ac.id/change_password.php",
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
};

function buildFormBody(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

const PASSWORD_RULES = {
  minLength: 8,
  uppercase: /[A-Z]/,
  lowercase: /[a-z]/,
  digit: /[0-9]/,
  special: /[!@#$%^&*]/,
};

function validateNewPassword(password: string): string | null {
  if (password.length < PASSWORD_RULES.minLength) {
    return "Minimal 8 karakter.";
  }
  if (!PASSWORD_RULES.uppercase.test(password)) {
    return "Minimal 1 huruf besar (A-Z).";
  }
  if (!PASSWORD_RULES.lowercase.test(password)) {
    return "Minimal 1 huruf kecil (a-z).";
  }
  if (!PASSWORD_RULES.digit.test(password)) {
    return "Minimal 1 angka (0-9).";
  }
  if (!PASSWORD_RULES.special.test(password)) {
    return "Minimal 1 karakter khusus (!@#$%^&*).";
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const sessionCookie = request.headers.get("X-Session-Cookie");
    const sessionId =
      request.headers.get("X-Session-Id") ??
      request.headers.get("cookie")?.match(/PHPSESSID=([^;]+)/)?.[1];
    let cookie = sessionCookie?.trim() || null;
    if (!cookie && sessionId) {
      const sid = sessionId.trim();
      if (sid.includes("%3A") || sid.length > 50) {
        cookie = `remember_me=${sid}`;
      } else {
        cookie = `PHPSESSID=${sid}`;
      }
    }
    if (!cookie) {
      return Response.json({ error: "Session required" }, { status: 401 });
    }

    const body = await request.json();
    const currentPassword = typeof body?.current_password === "string" ? body.current_password : "";
    const newPassword = typeof body?.new_password === "string" ? body.new_password : "";
    const confirmPassword = typeof body?.confirm_password === "string" ? body.confirm_password : "";

    if (!currentPassword || !newPassword || !confirmPassword) {
      return Response.json(
        { error: "current_password, new_password, dan confirm_password wajib diisi." },
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
        cookie,
      },
      body: formBody,
      cache: "no-store",
      redirect: "manual",
    });

    const html = await res.text();

    console.log("[change-password] CloudLab response:", {
      status: res.status,
      redirect: res.headers.get("location") ?? null,
      htmlLength: html.length,
      htmlSnippet: html.slice(0, 2000),
    });

    if (res.status === 301 || res.status === 302) {
      const location = (res.headers.get("location") ?? "").toLowerCase();
      if (location.includes("login")) {
        return Response.json(
          { error: "Sesi tidak valid. Silakan login lagi." },
          { status: 401 }
        );
      }
    }

    const isLoginPage =
      html.includes("Login - Presensi QR") ||
      html.includes("Masukkan email") ||
      html.includes('name="password"');

    if (isLoginPage) {
      return Response.json(
        { error: "Sesi tidak valid. Silakan login lagi." },
        { status: 401 }
      );
    }

    const isError =
      /password salah|kata sandi salah|wrong password|invalid password/i.test(html) ||
      /gagal|failed|error/i.test(html) && !/berhasil|success/i.test(html);
    const isSuccess =
      /berhasil|success|password telah|kata sandi telah|diubah/i.test(html) || (!isError && res.ok);

    if (isSuccess && !isError) {
      return Response.json({
        success: true,
        message: "Kata sandi berhasil diubah.",
      });
    }

    const errorMatch = html.match(/<div[^>]*class="[^"]*alert[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    const errorMsg = errorMatch
      ? errorMatch[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()
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
