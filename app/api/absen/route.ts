import { CLOUDLAB_URLS } from "@/lib/cloudlab";
import { fetchCloudLab, validateCloudLabResponse } from "@/lib/cloudlab/http";
import {
  requireSession,
  errorJson,
  successJson,
  withErrorHandler,
} from "@/lib/api-utils";

async function handleAbsen(request: Request): Promise<Response> {
  const [cookie, authError] = requireSession(request);
  if (authError) return authError;

  const body = await request.json();
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  if (!token) {
    return errorJson("Token required", 400);
  }

  const formBody = new URLSearchParams({ token });

  const result = await fetchCloudLab(CLOUDLAB_URLS.absen, {
    method: "POST",
    cookie,
    body: formBody.toString(),
    contentType: "application/x-www-form-urlencoded",
    referer: "https://cloudlab.amikom.ac.id/",
  });

  const validationError = validateCloudLabResponse(result, "absen");
  if (validationError) return validationError;

  const htmlLower = result.html.toLowerCase();
  const success =
    htmlLower.includes("berhasil") ||
    htmlLower.includes("success") ||
    htmlLower.includes("terima kasih") ||
    !htmlLower.includes("gagal");

  return successJson({
    message: success
      ? "Presensi berhasil dicatat."
      : "Presensi mungkin gagal. Periksa riwayat.",
  });
}

export const POST = withErrorHandler(handleAbsen);
