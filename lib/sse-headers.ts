/**
 * Headers for Server-Sent Events (SSE) so reverse proxies (e.g. Nginx) do not
 * buffer the body until the connection closes — which makes the Studio UI look
 * stuck on "loading" then dump all steps at once in production.
 */
export const SSE_RESPONSE_HEADERS: Record<string, string> = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  /** Nginx: disable response buffering for this request */
  "X-Accel-Buffering": "no",
};
