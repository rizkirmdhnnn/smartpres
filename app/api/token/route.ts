const CLOUDLAB_QR_URL =
  "https://cloudlab.amikom.ac.id/generate_qr.php?real_time=1";

export async function GET() {
  try {
    const res = await fetch(CLOUDLAB_QR_URL, {
      cache: "no-store",
    });

    if (!res.ok) {
      return Response.json(
        { error: "Failed to fetch QR data", status: res.status },
        { status: 502 }
      );
    }

    const data = await res.json();
    const token = data?.token ?? null;
    const expired_at = data?.expired_at ?? null;

    return Response.json({ token, expired_at });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unexpected error fetching QR";
    return Response.json({ error: message }, { status: 500 });
  }
}
