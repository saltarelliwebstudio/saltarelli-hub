import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAdmin } from "../_shared/auth.ts";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsOptions(req);
  }

  const authCheck = await verifyAdmin(req);
  if (authCheck.error) {
    return new Response(JSON.stringify({ error: authCheck.error }), {
      status: 401,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }

  try {
    const { client_name } = await req.json();

    if (!client_name || typeof client_name !== "string") {
      return new Response(
        JSON.stringify({ error: "client_name is required" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const search = client_name.trim();

    // Fuzzy match on name or company_name
    const { data: matches, error: findErr } = await sb
      .from("pods")
      .select("id, name, company_name")
      .or(`name.ilike.%${search}%,company_name.ilike.%${search}%`)
      .limit(5);

    if (findErr) throw findErr;

    if (!matches || matches.length === 0) {
      return new Response(
        JSON.stringify({ error: `No client found matching "${search}"` }),
        { status: 404, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Take the best match (first result)
    const client = matches[0];
    const now = new Date().toISOString();

    const { error: updateErr } = await sb
      .from("pods")
      .update({ last_contacted_at: now })
      .eq("id", client.id);

    if (updateErr) throw updateErr;

    const displayName = client.company_name || client.name;

    return new Response(
      JSON.stringify({
        ok: true,
        client_name: displayName,
        client_id: client.id,
        last_contacted_at: now,
        message: `Logged contact with ${displayName}`,
      }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("log-client-contact error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
