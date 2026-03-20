import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function parseDevice(ua: string): { device: string; browser: string } {
  const lower = ua.toLowerCase();

  let device = "desktop";
  if (/mobile|android.*mobile|iphone|ipod/.test(lower)) device = "mobile";
  else if (/tablet|ipad|android(?!.*mobile)/.test(lower)) device = "tablet";

  let browser = "other";
  if (/edg\//.test(lower)) browser = "Edge";
  else if (/chrome\//.test(lower) && !/chromium/.test(lower)) browser = "Chrome";
  else if (/safari\//.test(lower) && !/chrome/.test(lower)) browser = "Safari";
  else if (/firefox\//.test(lower)) browser = "Firefox";
  else if (/opera|opr\//.test(lower)) browser = "Opera";

  return { device, browser };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { path, referrer, sessionId } = await req.json();

    if (!path) {
      return new Response(
        JSON.stringify({ error: "path is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ua = req.headers.get("user-agent") || "";
    const { device, browser } = parseDevice(ua);

    // Get country from Cloudflare/Vercel headers (Supabase runs on Deno Deploy)
    const country = req.headers.get("cf-ipcountry") ||
      req.headers.get("x-vercel-ip-country") ||
      req.headers.get("x-country") ||
      null;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    await supabase.from("page_views").insert({
      path,
      referrer: referrer || null,
      user_agent: ua,
      device,
      browser,
      country,
      session_id: sessionId || null,
    });

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
