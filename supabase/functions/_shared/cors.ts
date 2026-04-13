const ALLOWED_ORIGINS = [
  "https://saltarelli-hub.vercel.app",
  "https://www.saltarelliwebstudio.ca",
  "https://saltarelliwebstudio.ca",
  "http://localhost:5173",
  "http://localhost:3000",
];

/**
 * Build CORS headers with origin validation.
 * Only allows requests from known origins instead of wildcard *.
 */
export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const isAllowed = ALLOWED_ORIGINS.includes(origin);
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  };
}

/**
 * Handle preflight OPTIONS request.
 */
export function handleCorsOptions(req: Request): Response {
  return new Response("ok", { headers: getCorsHeaders(req) });
}
