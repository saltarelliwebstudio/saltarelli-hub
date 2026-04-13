import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyCronOrAdmin } from "../_shared/auth.ts";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

const ADAM_PHONE = Deno.env.get("ADMIN_PHONE") || "+12899314142";

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
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
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

    // Stats: all-time totals
    const { data: allTimeLogs } = await supabase
      .from("sms_drip_log")
      .select("status");

    const sentAllTime = allTimeLogs?.filter((l) => l.status === "sent").length || 0;
    const failedAllTime = allTimeLogs?.filter((l) => l.status === "failed").length || 0;

    // Stats: leads by step
    const { data: stepData } = await supabase
      .from("admin_leads")
      .select("id, name, drip_step")
      .eq("drip_active", true)
      .is("drip_paused_at", null);

    const stepCounts: Record<number, number> = {};
    for (const lead of stepData || []) {
      const s = lead.drip_step || 0;
      stepCounts[s] = (stepCounts[s] || 0) + 1;
    }
    const stepSummary = Object.entries(stepCounts)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([step, count]) => `S${step}: ${count}`)
      .join(", ");

    // Stall detection: flag leads that should have advanced but haven't
    const STEP_DELAYS: Record<number, number> = { 1: 0, 2: 3, 3: 7, 4: 14, 5: 21, 6: 30, 7: 45 };
    const STALL_BUFFER_DAYS = 2; // alert if overdue by 2+ days
    const stalledLeads: string[] = [];

    for (const lead of stepData || []) {
      const currentStep = lead.drip_step || 0;
      const nextStep = currentStep + 1;
      if (nextStep > 7) continue;

      // Get the last successful send for this lead's current step
      const { data: lastLog } = await supabase
        .from("sms_drip_log")
        .select("sent_at")
        .eq("lead_id", lead.id)
        .eq("step", currentStep)
        .eq("status", "sent")
        .order("sent_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!lastLog) continue;

      const lastSent = new Date(lastLog.sent_at);
      const daysSince = Math.floor((Date.now() - lastSent.getTime()) / (1000 * 60 * 60 * 24));
      const expectedGap = (STEP_DELAYS[nextStep] || 0) - (STEP_DELAYS[currentStep] || 0);

      if (daysSince >= expectedGap + STALL_BUFFER_DAYS) {
        stalledLeads.push(`${lead.name} (S${currentStep}→${nextStep}, ${daysSince - expectedGap}d overdue)`);
      }
    }

    // Build message
    const lines = [
      `Drip Status Report`,
      `Active: ${activeCount || 0} leads`,
      `Last 24h: ${sent24h} sent, ${failed24h} failed`,
      `All-time: ${sentAllTime} sent, ${failedAllTime} failed`,
      `Replies: ${repliedCount || 0} total`,
      `Steps: ${stepSummary || "none"}`,
    ];

    if (failed24h > 0) {
      lines.push(`⚠️ ${failed24h} failures — check dashboard`);
    }

    if (stalledLeads.length > 0) {
      lines.push(`🚨 STALLED LEADS (${stalledLeads.length}):`);
      for (const s of stalledLeads.slice(0, 5)) {
        lines.push(`  - ${s}`);
      }
      if (stalledLeads.length > 5) {
        lines.push(`  + ${stalledLeads.length - 5} more`);
      }
    }

    if (sent24h === 0 && (activeCount || 0) > 0 && stalledLeads.length === 0) {
      lines.push(`No sends today — next batch not due yet`);
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
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: messageBody }),
      { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("daily-drip-status error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
