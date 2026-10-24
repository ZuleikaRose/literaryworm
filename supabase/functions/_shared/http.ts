// Response helpers. Errors always have the same shape so the UI can show a
// friendly message: { error: { code, message } }.

import { corsHeaders } from "./cors.ts";

export type ErrorCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "method_not_allowed"
  | "payload_too_large"
  | "rate_limited"
  | "upstream_error"
  | "upstream_timeout"
  | "server_error";

const STATUS: Record<ErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  method_not_allowed: 405,
  payload_too_large: 413,
  rate_limited: 429,
  upstream_error: 502,
  server_error: 500,
  upstream_timeout: 504,
};

export class HttpError extends Error {
  constructor(readonly code: ErrorCode, message: string, readonly retryAfter?: number) {
    super(message);
  }
}

export function json(req: Request, methods: string, body: unknown, status = 200, extra: HeadersInit = {}): Response {
  const headers = corsHeaders(req, methods);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("X-Content-Type-Options", "nosniff");
  for (const [k, v] of new Headers(extra)) headers.set(k, v);
  return new Response(JSON.stringify(body), { status, headers });
}

export function errorResponse(req: Request, methods: string, err: unknown): Response {
  if (err instanceof HttpError) {
    const extra: HeadersInit = err.retryAfter ? { "Retry-After": String(err.retryAfter) } : {};
    return json(req, methods, { error: { code: err.code, message: err.message } }, STATUS[err.code], extra);
  }
  // Never leak internals; log them for the function logs instead.
  console.error(err);
  return json(req, methods, { error: { code: "server_error", message: "Something went wrong. Try again." } }, 500);
}

export function requireMethod(req: Request, allowed: string[]): void {
  if (!allowed.includes(req.method)) {
    throw new HttpError("method_not_allowed", `Use ${allowed.join(" or ")}.`);
  }
}

const MAX_BODY_BYTES = 4 * 1024;

/** Reads a small JSON object body. Rejects anything large, non-JSON or not an object. */
export async function readJsonBody(req: Request): Promise<Record<string, unknown>> {
  const type = req.headers.get("Content-Type") ?? "";
  if (!type.toLowerCase().startsWith("application/json")) {
    throw new HttpError("bad_request", "Send JSON with Content-Type: application/json.");
  }
  const declared = Number(req.headers.get("Content-Length") ?? "0");
  if (declared > MAX_BODY_BYTES) throw new HttpError("payload_too_large", "Request body is too large.");
  const text = await req.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
    throw new HttpError("payload_too_large", "Request body is too large.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new HttpError("bad_request", "Request body isn't valid JSON.");
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new HttpError("bad_request", "Request body must be a JSON object.");
  }
  return parsed as Record<string, unknown>;
}

/** The caller's IP for rate limiting (first hop of X-Forwarded-For). */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("x-real-ip") || "unknown";
}
