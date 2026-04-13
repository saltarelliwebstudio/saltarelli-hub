import { verifyCronOrAdmin } from "../_shared/auth.ts";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

const MODAL_ENDPOINT =
  "https://leaky-bucket-audit-agent--sws-content-engine-trigger-wee-dcbedd.modal.run";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsOptions(req);
  }

  const authCheck = await verifyCronOrAdmin(req);
  if (authCheck.error) {
    return new Response(JSON.stringify({ error: authCheck.error }), {
      status: 401,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }

  try {
    const res = await fetch(MODAL_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });

    const data = await res.json();
    console.log("Weekly pipeline result:", JSON.stringify(data));

    return new Response(JSON.stringify(data), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Weekly pipeline error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
