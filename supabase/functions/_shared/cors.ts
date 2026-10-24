// CORS for every function. Only origins in ALLOWED_ORIGINS (comma-separated)
// get an Access-Control-Allow-Origin header, so other sites' pages can't read
// the responses. Defaults to the Vite dev server.

const DEFAULT_ORIGINS = "http://localhost:5173";

export function allowedOrigins(): string[] {
  return (Deno.env.get("ALLOWED_ORIGINS") ?? DEFAULT_ORIGINS)
    .split(",")
    .map((o) => o.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

export function corsHeaders(req: Request, methods: string): Headers {
  const headers = new Headers({
    "Access-Control-Allow-Methods": `${methods}, OPTIONS`,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  });
  const origin = req.headers.get("Origin");
  if (origin && allowedOrigins().includes(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
  }
  return headers;
}

/** Answers the browser's preflight. Returns null for every other method. */
export function preflight(req: Request, methods: string): Response | null {
  if (req.method !== "OPTIONS") return null;
  return new Response(null, { status: 204, headers: corsHeaders(req, methods) });
}
