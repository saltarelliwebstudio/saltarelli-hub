import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADAM_PHONE = "+12899314142";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    // Stats: total active drips
    const { count: activeCount } = await supabase
      .from("admin_leads")
      .select("id", { count: "exact", head: true })
      .eq("drip_active", true)
      .is("drip_paused_at", null);

    // Stats: messages sent in last 24h
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentLogs } = await supabase
      .from("sms_drip_log")
      .select("status")
      .gte("sent_at", yesterday);

    const sent24h = recentLogs?.filter((l) => l.status === "sent").length || 0;
    const failed24h = recentLogs?.filter((l) => l.status === "failed").length || 0;

    // Stats: replies (leads that became "replied" status)
    const { count: repliedCount } = await supabase
      .from("admin_leads")
      .select("id", { count: "exact", head: true })
      .eq("status", "replied");

    // Stats: leads by step
    const { data: stepData } = await supabase
      .from("admin_leads")
      .select("drip_step")
      .eq("drip_active", true);

    const stepCounts: Record<number, number> = {};
    for (const lead of stepData || []) {
      const s = lead.drip_step || 0;
      stepCounts[s] = (stepCounts[s] || 0) + 1;
    }
    const stepSummary = Object.entries(stepCounts)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([step, count]) => `S${step}: ${count}`)
      .join(", ");

    // Build message
    const lines = [
      `Drip Status Report`,
      `Active: ${activeCount || 0} leads`,
      `Last 24h: ${sent24h} sent, ${failed24h} failed`,
      `Replies: ${repliedCount || 0} total`,
      `Steps: ${stepSummary || "none"}`,
    ];

    if (failed24h > 0) {
      lines.push(`⚠️ ${failed24h} failures — check dashboard`);
    }

    if (sent24h === 0 && (activeCount || 0) > 0) {
      lines.push(`ℹ️ No sends today — next batch may not be due yet`);
    }

    const messageBody = lines.join("\n");

    // Send via OpenPhone
    const openphoneRes = await fetch("https://api.openphone.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiKey,
      },
      body: JSON.stringify({
        content: messageBody,
        from: phoneNumberId,
        to: [ADAM_PHONE],
      }),
    });

    if (!openphoneRes.ok) {
      const errBody = await openphoneRes.text();
      return new Response(
        JSON.stringify({ error: `OpenPhone API ${openphoneRes.status}: ${errBody}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: messageBody }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("daily-drip-status error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
