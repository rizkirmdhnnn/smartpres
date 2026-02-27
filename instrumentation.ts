/**
 * Next.js Instrumentation — runs once when the server starts.
 *
 * Sends a Telegram notification to inform that the domain is active.
 * See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
    // Only run on the Node.js runtime (skip for Edge)
    if (process.env.NEXT_RUNTIME === "nodejs") {
        // Dynamic import to avoid bundling server-only code into the edge runtime
        const { notifyDomainActive } = await import("@/app/lib/telegram");

        console.log("[instrumentation] Server starting — sending Telegram notification...");

        const result = await notifyDomainActive();

        if (result.success) {
            console.log("[instrumentation] ✅ Telegram notification sent successfully");
        } else {
            console.warn("[instrumentation] ⚠️ Failed to send Telegram notification:", result.error);
        }
    }
}
