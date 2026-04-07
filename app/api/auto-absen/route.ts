import { errorJson, successJson, withErrorHandler } from "@/lib/api-utils";
 
async function handleAutoAbsen(request: Request): Promise<Response> {
  const { email, password } = await request.json();
  if (!email || !password) {
    return errorJson("Email dan password wajib diisi.", 400);
  }
 
  const origin = new URL(request.url).origin;
 
  // ── 1. Login (sama seperti halaman login) ──────────────────────
  const loginRes = await fetch(`${origin}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const loginData = await loginRes.json();
  if (!loginData.success) {
    return errorJson(loginData.message || "Email atau password salah!", 401);
  }
 
  // Bangun header auth (sama seperti useSession.getHeaders)
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (loginData.sessionCookie) headers["X-Session-Cookie"] = loginData.sessionCookie;
  else if (loginData.sessionId) headers["X-Session-Id"] = loginData.sessionId;
 
  // ── 2. Ambil Token (sama seperti tombol "Ambil Token") ─────────
  const tokenRes = await fetch(`${origin}/api/token`);
  const tokenData = await tokenRes.json();
  if (!tokenData.token) {
    return errorJson("Token presensi tidak tersedia saat ini.", 400);
  }
 
  // Extract hash dari URL (sama seperti extractTokenFromDecoded)
  let token = tokenData.token.trim();
  try {
    const url = new URL(token);
    token = url.searchParams.get("token") ?? url.searchParams.get("q") ?? token;
  } catch {
    // bukan URL, langsung pakai sebagai token
  }
 
  // ── 3. Kirim presensi (sama seperti tombol "Kirim presensi") ───
  const absenRes = await fetch(`${origin}/api/absen`, {
    method: "POST",
    headers,
    body: JSON.stringify({ token }),
  });
  const absenData = await absenRes.json();
 
  if (!absenRes.ok) {
    return errorJson(absenData?.error || "Gagal mengirim presensi.", absenRes.status === 401 ? 401 : 400);
  }
 
  return successJson({
    message: absenData?.message || "Presensi berhasil dicatat.",
    token,
    debugAbsenData: absenData
  });
}
 
export const POST = withErrorHandler(handleAutoAbsen);
 