import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Delay schedule: step → days since last step was sent
const STEP_DELAYS: Record<number, number> = {
  1: 0,  // immediate
  2: 3,
  3: 7,
  4: 14,
  5: 21,
  6: 30,
  7: 45,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const results = { processed: 0, sent: 0, skipped: 0, errors: 0 };

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Fetch eligible leads
    const { data: leads, error: leadsError } = await supabase
      .from("admin_leads")
      .select("*")
      .eq("drip_active", true)
      .is("drip_paused_at", null)
      .lt("drip_step", 7)
      .not("phone", "is", null)
      .not("status", "in", '("closed","client")');

    if (leadsError) {
      console.error("Error fetching leads:", leadsError);
      return new Response(
        JSON.stringify({ error: leadsError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!leads || leads.length === 0) {
      return new Response(
        JSON.stringify({ ...results, message: "No eligible leads" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch OpenPhone credentials
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

    // Drip templates (duplicated here to avoid cross-function imports in Supabase Edge)
    const DRIP_TEMPLATES: Record<number, (name: string) => string> = {
      1: (name) => `Hey ${name}! Thanks for your interest in Saltarelli Web Studio. We'd love to learn more about your project. When's a good time to chat?`,
      2: (name) => `Hi ${name}, just following up! We specialize in building modern web apps and automations for small businesses. Any questions we can answer?`,
      3: (name) => `Hey ${name}, quick check-in — still interested in leveling up your online presence? We have some availability opening up soon.`,
      4: (name) => `Hi ${name}! Just wanted to share that we recently helped a client launch their new site in under 2 weeks. Would love to do the same for you!`,
      5: (name) => `Hey ${name}, we're running a special this month for new clients. Want to hear the details? Just reply and we'll fill you in.`,
      6: (name) => `Hi ${name}, it's been a month since we first connected. If you're still thinking about a web project, we're here to help whenever you're ready!`,
      7: (name) => `Hey ${name}, just one last note — our door is always open if you decide to move forward. Feel free to reach out anytime. Best of luck!`,
    };

    const now = new Date();

    for (const lead of leads) {
      results.processed++;
      const nextStep = (lead.drip_step || 0) + 1;

      if (nextStep > 7) {
        results.skipped++;
        continue;
      }

      // Check delay requirement
      const requiredDelay = STEP_DELAYS[nextStep] || 0;

      if (nextStep > 1) {
        // Find when the last step was sent
        const { data: lastLog } = await supabase
          .from("sms_drip_log")
          .select("sent_at")
          .eq("lead_id", lead.id)
          .eq("step", lead.drip_step)
          .eq("status", "sent")
          .order("sent_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!lastLog) {
          // Last step has no successful send — skip
          results.skipped++;
          continue;
        }

        const lastSentAt = new Date(lastLog.sent_at);
        const daysSinceLast = Math.floor((now.getTime() - lastSentAt.getTime()) / (1000 * 60 * 60 * 24));

        if (daysSinceLast < requiredDelay) {
          results.skipped++;
          continue;
        }
      }

      // Check for duplicate
      const { data: existingLog } = await supabase
        .from("sms_drip_log")
        .select("id")
        .eq("lead_id", lead.id)
        .eq("step", nextStep)
        .eq("status", "sent")
        .maybeSingle();

      if (existingLog) {
        results.skipped++;
        continue;
      }

      // Build message
      const firstName = lead.name.split(" ")[0];
      const templateFn = DRIP_TEMPLATES[nextStep];
      if (!templateFn) {
        results.skipped++;
        continue;
      }
      const messageBody = templateFn(firstName);

      // Send via OpenPhone
      let openphoneMessageId: string | null = null;
      let sendError: string | null = null;

      try {
        const openphoneRes = await fetch("https://api.openphone.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: apiKey,
          },
          body: JSON.stringify({
            content: messageBody,
            from: phoneNumberId,
            to: [lead.phone],
          }),
        });

        if (!openphoneRes.ok) {
          const errBody = await openphoneRes.text();
          sendError = `OpenPhone API ${openphoneRes.status}: ${errBody}`;
        } else {
          const resData = await openphoneRes.json();
          openphoneMessageId = resData.data?.id || resData.id || null;
        }
      } catch (err) {
        sendError = err instanceof Error ? err.message : "Unknown send error";
      }

      const status = sendError ? "failed" : "sent";

      // Log
      await supabase.from("sms_drip_log").insert({
        lead_id: lead.id,
        step: nextStep,
        message_body: messageBody,
        status,
        openphone_message_id: openphoneMessageId,
        error_message: sendError,
      });

      if (!sendError) {
        // Update lead
        await supabase
          .from("admin_leads")
          .update({
            drip_step: nextStep,
            last_contacted_date: now.toISOString().split("T")[0],
          })
          .eq("id", lead.id);

        results.sent++;
      } else {
        console.error(`Drip send failed for lead ${lead.id} step ${nextStep}:`, sendError);
        results.errors++;
      }
    }

    console.log("Drip queue processed:", results);

    return new Response(
      JSON.stringify(results),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("process-drip-queue error:", message);
    return new Response(
      JSON.stringify({ error: message, ...results }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
