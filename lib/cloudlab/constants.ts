export const CLOUDLAB_BASE_URL = "https://cloudlab.amikom.ac.id";

export const CLOUDLAB_URLS = {
  login: `${CLOUDLAB_BASE_URL}/login.php`,
  dashboard: `${CLOUDLAB_BASE_URL}/dashboard.php`,
  history: `${CLOUDLAB_BASE_URL}/riwayat.php`,
  absen: `${CLOUDLAB_BASE_URL}/process_presensi.php`,
  changePassword: `${CLOUDLAB_BASE_URL}/change_password.php`,
  qrToken: `${CLOUDLAB_BASE_URL}/generate_qr.php?real_time=1`,
  realtimePresensi: `${CLOUDLAB_BASE_URL}/realtime_presensi.php`,
} as const;

export const BROWSER_HEADERS: Record<string, string> = {
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};
