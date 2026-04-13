import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyCronOrAdmin } from "../_shared/auth.ts";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

/** Normalise a phone number to E.164 digits-only for matching */
function normaliseDigits(raw: string): string {
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length === 10) return `1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return digits;
  return digits;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsOptions(req);
  }

  const corsHeaders = getCorsHeaders(req);

  try {
    // Verify caller is service_role (webhook) or admin
    const authResult = await verifyCronOrAdmin(req);
    if (authResult.error) {
      return new Response(
        JSON.stringify({ error: authResult.error }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();

    // OpenPhone/Quo webhook sends events with type and data
    // Inbound messages have type "message.received" or similar
    const eventType = body.type || body.event || "";
    const message = body.data?.object || body.data || body;

    // Only process inbound messages
    const direction = message.direction || "";
    if (direction !== "incoming" && !eventType.includes("received")) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "not an inbound message" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the sender's phone number
    const from = message.from || (message.participants && message.participants[0]) || "";
    if (!from) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "no from number" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fromDigits = normaliseDigits(from);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Find matching lead by phone number (try various formats)
    const { data: leads } = await supabase
      .from("admin_leads")
      .select("id, name, phone, drip_active, status")
      .eq("drip_active", true);

    if (!leads || leads.length === 0) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "no active drip leads" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Match by normalised digits
    const matchedLead = leads.find((lead) => {
      if (!lead.phone) return false;
      return normaliseDigits(lead.phone) === fromDigits;
    });

    if (!matchedLead) {
      return new Response(
        JSON.stringify({ skipped: true, reason: `no lead matches phone ${from}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Pause the drip — lead replied
    const { error: updateError } = await supabase
      .from("admin_leads")
      .update({
        drip_active: false,
        drip_paused_at: new Date().toISOString(),
        status: matchedLead.status === "cold" ? "replied" : matchedLead.status,
      })
      .eq("id", matchedLead.id);

    if (updateError) {
      console.error("Failed to pause drip:", updateError);
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Drip stopped for ${matchedLead.name} (${from}) — they replied`);

    return new Response(
      JSON.stringify({
        success: true,
        lead_id: matchedLead.id,
        lead_name: matchedLead.name,
        action: "drip_stopped",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("openphone-webhook error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
