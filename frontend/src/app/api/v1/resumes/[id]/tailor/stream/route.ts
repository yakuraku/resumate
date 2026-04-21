/**
 * Edge Runtime proxy for the AI Tailor SSE stream.
 *
 * Vercel Serverless Functions have a 25-second hard timeout, which the agentic
 * tailor (up to 10 LLM iterations) will routinely exceed. By running this
 * specific route on the Edge Runtime there is no timeout, and the SSE stream
 * is forwarded directly to the browser without buffering.
 *
 * This Route Handler takes precedence over the catch-all rewrite in
 * next.config.ts for this exact path, so the rewrite is never used for SSE.
 */
export const runtime = "edge";

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8921";
    const targetUrl = `${backendUrl}/api/v1/resumes/${id}/tailor/stream`;

    const forwardHeaders = new Headers();
    forwardHeaders.set("content-type", "application/json");

    const cookie = request.headers.get("cookie");
    if (cookie) forwardHeaders.set("cookie", cookie);

    const csrfToken = request.headers.get("x-csrf-token");
    if (csrfToken) forwardHeaders.set("x-csrf-token", csrfToken);

    const body = await request.text();

    const backendResponse = await fetch(targetUrl, {
        method: "POST",
        headers: forwardHeaders,
        body,
    });

    if (!backendResponse.ok || !backendResponse.body) {
        return new Response(backendResponse.body, {
            status: backendResponse.status,
            headers: { "content-type": "application/json" },
        });
    }

    return new Response(backendResponse.body, {
        status: 200,
        headers: {
            "content-type": "text/event-stream; charset=utf-8",
            "cache-control": "no-cache, no-transform",
            "x-accel-buffering": "no",
        },
    });
}
