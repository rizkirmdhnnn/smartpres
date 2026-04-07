import { CLOUDLAB_URLS } from "@/lib/cloudlab";
import { errorJson, withErrorHandler } from "@/lib/api-utils";

async function handleToken(): Promise<Response> {
  const res = await fetch(CLOUDLAB_URLS.qrToken, { cache: "no-store" });

  if (!res.ok) {
    return errorJson("Failed to fetch QR data", 502);
  }

  const data = await res.json();
  return Response.json({
    token: data?.token ?? null,
    expired_at: data?.expired_at ?? null,
  });
}

export const GET = withErrorHandler(handleToken as (req: Request) => Promise<Response>);
