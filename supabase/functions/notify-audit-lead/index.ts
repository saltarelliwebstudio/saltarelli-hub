import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADAM_PHONE = "+12899314142";

function normalisePhone(raw: string): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, email, phone, score, revenueLeak, hoursLost } = await req.json();

    if (!name || !phone) {
      return new Response(
        JSON.stringify({ error: "name and phone are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Get OpenPhone credentials
    const { data: settings } = await supabase
      .from("integration_settings")
      .select("key, value")
      .in("key", ["openphone_api_key", "openphone_phone_number_id"]);

    const settingsMap = new Map(settings?.map((s: { key: string; value: string }) => [s.key, s.value]) || []);
    const apiKey = settingsMap.get("openphone_api_key");
    const phoneNumberId = settingsMap.get("openphone_phone_number_id");

    if (!apiKey || !phoneNumberId) {
      return new Response(
        JSON.stringify({ error: "OpenPhone credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normPhone = normalisePhone(phone);
    const leakFormatted = (revenueLeak || 0).toLocaleString();
    const hoursFormatted = hoursLost || 0;

    // Duplicate detection — skip insert if phone already exists
    let leadAction = "created";
    if (normPhone) {
      const { data: existing } = await supabase
        .from("admin_leads")
        .select("id")
        .eq("phone", normPhone)
        .maybeSingle();

      if (!existing) {
        // Create lead in admin_leads — DB triggers auto-fire drip Step 1
        const { error: insertError } = await supabase.from("admin_leads").insert({
          name,
          email: email || null,
          phone: normPhone,
          source: "after-hours-audit",
          service_interest: "Smart Stack Pack",
          status: "warm",
          notes: `Score: ${score}\nRevenue Leak: $${leakFormatted}\nHours Lost: ${hoursFormatted}`,
          drip_active: true,
          date_added: new Date().toISOString().split("T")[0],
        });

        if (insertError) {
          console.error("Failed to create lead:", insertError);
          leadAction = "insert_failed";
        }
      } else {
        leadAction = "duplicate_skipped";
      }
    }

    // Send notification to Adam
    const adamMessage = `New Audit Lead!\n\nName: ${name}\nPhone: ${phone}\nScore: ${score}/10\nEst. Leak: $${leakFormatted}/yr\nHours Lost: ${hoursFormatted} hrs/yr\nLead: ${leadAction}\n\nThey just finished the After-Hours Audit on saltarelliwebstudio.ca. Drip step 1 is firing automatically.`;

    await fetch("https://api.openphone.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiKey,
      },
      body: JSON.stringify({
        content: adamMessage,
        from: phoneNumberId,
        to: [ADAM_PHONE],
      }),
    });

    return new Response(
      JSON.stringify({ success: true, leadAction }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("notify-audit-lead error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
