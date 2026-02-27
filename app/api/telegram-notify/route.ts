import { notifyDomainActive } from "@/app/lib/telegram";

/**
 * GET /api/telegram-notify
 *
 * Manual trigger to send a Telegram notification that the domain is active.
 * Useful for health-check and testing.
 */
export async function GET() {
    const result = await notifyDomainActive();

    if (result.success) {
        return Response.json(
            {
                success: true,
                message: "Telegram notification sent successfully",
            },
            { status: 200 },
        );
    }

    return Response.json(
        {
            success: false,
            error: result.error ?? "Failed to send notification",
        },
        { status: 500 },
    );
}
