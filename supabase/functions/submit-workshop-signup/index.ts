import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

interface SignupPayload {
  name?: string;
  email?: string;
  workshop_name?: string;
  workshop_date?: string;
  source?: string;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsOptions(req);
  }

  const cors = getCorsHeaders(req);
  const jsonHeaders = { ...cors, "Content-Type": "application/json" };

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  let payload: SignupPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  const name = (payload.name || "").trim();
  const email = (payload.email || "").trim().toLowerCase();

  if (!name || name.length > 200) {
    return new Response(JSON.stringify({ error: "invalid_name" }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  if (!email || !isValidEmail(email) || email.length > 320) {
    return new Response(JSON.stringify({ error: "invalid_email" }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const workshopName =
    (payload.workshop_name || "").trim() || "AI Systems for Business Owners";
  const workshopDate = payload.workshop_date || "2026-05-07";
  const source = (payload.source || "").trim() || "saltarelliwebstudio.ca";

  // Dedup: if this email already signed up for this workshop date, no-op with 200
  const { data: existing } = await supabase
    .from("workshop_signups")
    .select("id")
    .eq("email", email)
    .eq("workshop_date", workshopDate)
    .maybeSingle();

  if (existing) {
    return new Response(
      JSON.stringify({ ok: true, status: "already_signed_up" }),
      { status: 200, headers: jsonHeaders }
    );
  }

  const { error } = await supabase.from("workshop_signups").insert({
    name,
    email,
    workshop_name: workshopName,
    workshop_date: workshopDate,
    source,
  });

  if (error) {
    console.error("workshop signup insert failed:", error);
    return new Response(JSON.stringify({ error: "db_error" }), {
      status: 500,
      headers: jsonHeaders,
    });
  }

  return new Response(JSON.stringify({ ok: true, status: "created" }), {
    status: 200,
    headers: jsonHeaders,
  });
});
