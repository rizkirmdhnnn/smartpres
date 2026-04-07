import { CLOUDLAB_URLS } from "@/lib/cloudlab";
import { fetchCloudLab, validateCloudLabResponse } from "@/lib/cloudlab/http";
import {
  requireSession,
  errorJson,
  successJson,
  withErrorHandler,
} from "@/lib/api-utils";

const PASSWORD_RULES = {
  minLength: 8,
  uppercase: /[A-Z]/,
  lowercase: /[a-z]/,
  digit: /[0-9]/,
  special: /[!@#$%^&*]/,
} as const;

function validateNewPassword(password: string): string | null {
  if (password.length < PASSWORD_RULES.minLength)
    return "Minimal 8 karakter.";
  if (!PASSWORD_RULES.uppercase.test(password))
    return "Minimal 1 huruf besar (A-Z).";
  if (!PASSWORD_RULES.lowercase.test(password))
    return "Minimal 1 huruf kecil (a-z).";
  if (!PASSWORD_RULES.digit.test(password))
    return "Minimal 1 angka (0-9).";
  if (!PASSWORD_RULES.special.test(password))
    return "Minimal 1 karakter khusus (!@#$%^&*).";
  return null;
}

async function handleChangePassword(request: Request): Promise<Response> {
  const [cookie, authError] = requireSession(request);
  if (authError) return authError;

  const body = await request.json();
  const currentPassword =
    typeof body?.current_password === "string" ? body.current_password : "";
  const newPassword =
    typeof body?.new_password === "string" ? body.new_password : "";
  const confirmPassword =
    typeof body?.confirm_password === "string" ? body.confirm_password : "";

  if (!currentPassword || !newPassword || !confirmPassword) {
    return errorJson(
      "current_password, new_password, dan confirm_password wajib diisi.",
      400,
    );
  }

  if (newPassword !== confirmPassword) {
    return errorJson("Kata sandi baru dan konfirmasi tidak sama.", 400);
  }

  const passwordError = validateNewPassword(newPassword);
  if (passwordError) return errorJson(passwordError, 400);

  const formBody = new URLSearchParams({
    current_password: currentPassword,
    new_password: newPassword,
    confirm_password: confirmPassword,
  }).toString();

  const result = await fetchCloudLab(CLOUDLAB_URLS.changePassword, {
    method: "POST",
    cookie,
    body: formBody,
    contentType: "application/x-www-form-urlencoded",
    referer: CLOUDLAB_URLS.changePassword,
  });

  const validationError = validateCloudLabResponse(
    result,
    "change-password",
  );
  if (validationError) return validationError;

  const { html } = result;

  const isError =
    /password salah|kata sandi salah|wrong password|invalid password/i.test(
      html,
    ) ||
    (/gagal|failed|error/i.test(html) && !/berhasil|success/i.test(html));

  const isSuccess =
    /berhasil|success|password telah|kata sandi telah|diubah/i.test(html) ||
    (!isError && result.status >= 200 && result.status < 300);

  if (isSuccess && !isError) {
    return successJson({ message: "Kata sandi berhasil diubah." });
  }

  const alertMatch = html.match(
    /<div[^>]*class="[^"]*alert[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
  );
  const errorMsg = alertMatch
    ? alertMatch[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()
    : "Kata sandi gagal diubah. Periksa kata sandi lama.";

  return errorJson(errorMsg || "Kata sandi gagal diubah.", 400);
}

export const POST = withErrorHandler(handleChangePassword);
