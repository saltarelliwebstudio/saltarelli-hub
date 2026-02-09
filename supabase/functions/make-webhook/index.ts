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

    // Accept pod_id from URL param or body
    const podId = url.searchParams.get("pod_id") || body.pod_id;
    if (!podId) {
      return new Response(
        JSON.stringify({ error: "pod_id is required (pass as URL param or in body)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Accept field names from Make.com (Name, Email, Phone Number, Service, Best Time)
    // or standard lowercase (name, email, phone, notes)
    const name = body.Name || body.name || "Form Submission";
    const email = body.Email || body.email || null;
    const phone = body["Phone Number"] || body.phone || null;
    const service = body.Service || body.service || null;
    const bestTime = body["Best Time"] || body.best_time || null;
    const notes = body.notes || [service && `Service: ${service}`, bestTime && `Best Time: ${bestTime}`].filter(Boolean).join(", ") || null;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 1. Create a lead
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .insert({
        pod_id: podId,
        name,
        phone,
        email,
        notes,
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
        pod_id: podId,
        module_type: "leads",
        event_type: "form_submission",
        event_label: `New lead: ${name}`,
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
