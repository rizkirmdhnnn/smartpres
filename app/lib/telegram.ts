/**
 * Telegram Bot API utility for sending notifications.
 *
 * Reads configuration from environment variables:
 *   TELEGRAM_BOT_TOKEN  – Bot token from @BotFather
 *   TELEGRAM_CHAT_ID    – Target chat / user ID
 *   DOMAIN_NAME         – Domain name reported in messages
 */

const TELEGRAM_API_BASE = "https://api.telegram.org";

interface TelegramResponse {
    ok: boolean;
    description?: string;
}

/**
 * Send a plain-text message via the Telegram Bot API.
 */
export async function sendTelegramMessage(message: string): Promise<{ success: boolean; error?: string }> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || token === "YOUR_BOT_TOKEN_HERE") {
        const err = "TELEGRAM_BOT_TOKEN is not configured in .env";
        console.warn(`[telegram] ${err}`);
        return { success: false, error: err };
    }

    if (!chatId) {
        const err = "TELEGRAM_CHAT_ID is not configured in .env";
        console.warn(`[telegram] ${err}`);
        return { success: false, error: err };
    }

    try {
        const url = `${TELEGRAM_API_BASE}/bot${token}/sendMessage`;

        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: "HTML",
            }),
        });

        const data: TelegramResponse = await res.json();

        if (!data.ok) {
            console.error("[telegram] API error:", data.description);
            return { success: false, error: data.description ?? "Unknown Telegram API error" };
        }

        console.log("[telegram] Message sent successfully");
        return { success: true };
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to send Telegram message";
        console.error("[telegram] Network error:", message);
        return { success: false, error: message };
    }
}

/**
 * Send a "domain is active" notification with timestamp.
 */
export async function notifyDomainActive(): Promise<{ success: boolean; error?: string }> {
    const domain = process.env.DOMAIN_NAME ?? "unknown-domain";
    const now = new Date();

    // Format: "27 Feb 2026, 12:39 WIB"
    const formatted = now.toLocaleString("id-ID", {
        timeZone: "Asia/Jakarta",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    });

    const message = [
        "🟢 <b>Server Active</b>",
        "",
        `🌐 Domain: <code>${domain}</code>`,
        `🕐 Waktu: ${formatted} WIB`,
        `📡 Status: Online`,
        "",
        "SmartPres server berhasil dijalankan.",
    ].join("\n");

    return sendTelegramMessage(message);
}
