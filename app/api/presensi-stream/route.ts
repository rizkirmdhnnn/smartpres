import { CLOUDLAB_URLS } from "@/lib/cloudlab";

export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;

      const safeClose = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      const safeEnqueue = (chunk: Uint8Array) => {
        if (closed) return;
        try {
          controller.enqueue(chunk);
        } catch {
          closed = true;
        }
      };

      const sendEvent = (event: string, data: string) => {
        safeEnqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
      };

      try {
        const res = await fetch(CLOUDLAB_URLS.realtimePresensi, {
          cache: "no-store",
          headers: { accept: "text/event-stream" },
        });

        if (!res.ok || !res.body) {
          sendEvent(
            "error",
            JSON.stringify({ error: "Failed to connect to SSE source" }),
          );
          safeClose();
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const pump = async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() ?? "";

              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                if (trimmed.startsWith("data: ")) {
                  sendEvent("presensi_update", trimmed.slice(6));
                }
              }
            }
          } catch {
            // stream ended or aborted
          } finally {
            safeClose();
          }
        };

        pump();
      } catch {
        sendEvent(
          "error",
          JSON.stringify({ error: "SSE connection failed" }),
        );
        safeClose();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Connection: "keep-alive",
    },
  });
}
