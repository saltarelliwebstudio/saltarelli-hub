import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify webhook secret
    const url = new URL(req.url);
    const secret = url.searchParams.get("secret");
    const expectedSecret = Deno.env.get("MAKE_WEBHOOK_SECRET");

    if (!expectedSecret || secret !== expectedSecret) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { pod_id, name, phone, email, notes } = body;

    if (!pod_id) {
      return new Response(
        JSON.stringify({ error: "pod_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 1. Create a lead
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .insert({
        pod_id,
        name: name || "Form Submission",
        phone: phone || null,
        email: email || null,
        notes: notes || null,
        source: "web_form",
        status: "new",
      })
      .select("id")
      .single();

    if (leadError) {
      console.error("Lead insert error:", leadError);
      return new Response(
        JSON.stringify({ error: leadError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Log the automation run
    const { error: logError } = await supabase
      .from("automation_logs")
      .insert({
        pod_id,
        module_type: "leads",
        event_type: "form_submission",
        event_label: `New lead: ${name || "Unknown"}`,
        payload: { lead_id: lead.id, source: "make_webhook", ...body },
        status: "success",
      });

    if (logError) {
      console.error("Automation log error:", logError);
    }

    return new Response(
      JSON.stringify({ success: true, lead_id: lead.id }),
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
