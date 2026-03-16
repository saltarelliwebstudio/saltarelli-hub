import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// 3-step drip: Day 0, Day 3, Day 7
const STEP_DELAYS: Record<number, number> = {
  1: 0,  // immediate
  2: 3,
  3: 7,
};

const MAX_STEPS = 3;
const MAX_FAILURES = 3; // deactivate drip after 3 failures per step

const DRIP_TEMPLATES: Record<number, string> = {
  1: `Hey [Name]! Adam from Saltarelli Web Studio here in Niagara. Recently helped Zach at Melnyk Concrete get back 5+ hrs/week with a simple AI automation. Worth a 2-second chat? Just reply and I'll send over a 60-sec video showing exactly what I mean.`,
  2: `Hey [Name], know you're busy. Just wanted you to know I'm reaching out because I genuinely think this saves you time — not just to sell you something. Zach at Melnyk Concrete said the same thing before we started 😄. Reply and I'll send you a quick video, no strings attached. - Adam`,
  3: `Me waiting for you to respond 😅 — but seriously [Name], just reply and I'll shoot you a 60-sec video. That's it. - Adam`,
};

/** Normalise a phone number to E.164 format (+1XXXXXXXXXX) */
function normalisePhone(raw: string): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

/** Build personalised message from template + lead */
function buildMessage(template: string, lead: { name: string; service_interest: string | null }): string {
  const firstName = (lead.name || "there").split(" ")[0].trim();
  return template.replace(/\[Name\]/g, firstName);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const results = { processed: 0, sent: 0, skipped: 0, errors: 0, deactivated: 0 };

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Fetch eligible leads — only those with drip active, not paused, not done
    const { data: leads, error: leadsError } = await supabase
      .from("admin_leads")
      .select("*")
      .eq("drip_active", true)
      .is("drip_paused_at", null)
      .lt("drip_step", MAX_STEPS)
      .not("phone", "is", null)
      .not("status", "in", '("closed","client","do_not_contact")');

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

    const now = new Date();

    for (const lead of leads) {
      results.processed++;
      const nextStep = (lead.drip_step || 0) + 1;

      if (nextStep > MAX_STEPS) {
        results.skipped++;
        continue;
      }

      // Validate phone format
      const normalisedPhone = normalisePhone(lead.phone);
      if (!normalisedPhone) {
        // Invalid phone — deactivate drip, skip
        await supabase
          .from("admin_leads")
          .update({ drip_active: false })
          .eq("id", lead.id);
        results.deactivated++;
        continue;
      }

      // Check how many times this step has already failed
      const { count: failCount } = await supabase
        .from("sms_drip_log")
        .select("id", { count: "exact", head: true })
        .eq("lead_id", lead.id)
        .eq("step", nextStep)
        .eq("status", "failed");

      if ((failCount || 0) >= MAX_FAILURES) {
        // Too many failures — deactivate drip
        await supabase
          .from("admin_leads")
          .update({ drip_active: false })
          .eq("id", lead.id);
        results.deactivated++;
        continue;
      }

      // Check delay requirement
      if (nextStep > 1) {
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
          results.skipped++;
          continue;
        }

        const lastSentAt = new Date(lastLog.sent_at);
        const daysSinceLast = Math.floor((now.getTime() - lastSentAt.getTime()) / (1000 * 60 * 60 * 24));
        const requiredDelay = STEP_DELAYS[nextStep] || 0;

        if (daysSinceLast < requiredDelay) {
          results.skipped++;
          continue;
        }
      }

      // Check for duplicate successful send
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
      const template = DRIP_TEMPLATES[nextStep];
      if (!template) {
        results.skipped++;
        continue;
      }
      const messageBody = buildMessage(template, lead);

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
            to: [normalisedPhone],
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
