import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Delay schedule: step → days since step 1 was sent
const STEP_DELAYS: Record<number, number> = {
  1: 0,  // immediate
  2: 3,
  3: 7,
  4: 14,
  5: 21,
  6: 30,
  7: 45,
};

// Same templates as send-drip-sms (duplicated — Edge Functions can't share modules)
const DRIP_TEMPLATES: Record<number, string> = {
  1: `Hey [Name]! Adam from Saltarelli Web Studio here in Niagara. Recently helped Zach at Melnyk Concrete get back 5+ hrs/week with a simple AI automation. Worth a 2-second chat? Just reply and I'll send over a 60-sec video showing exactly what I mean.`,
  2: `Hey [Name], know you're busy. Just wanted you to know I'm reaching out because I genuinely think this saves you time — not just to sell you something. Zach at Melnyk Concrete said the same thing before we started 😄. Reply and I'll send you a quick video, no strings attached. - Adam`,
  3: `Me waiting for you to respond 😅 — but seriously [Name], just reply and I'll shoot you a 60-sec video. That's it. - Adam`,
  4: `Hey [Name]… it's me again. Had two businesses sign on this week so I'm filling up — but I've kept a spot open with you in mind. Just reply and I'll send the video over. - Adam`,
  5: `Hey [Name], almost fully booked for the season. Just wrapped up with Melnyk Concrete — saved them hours every week on admin. One spot left. Reply and I'll show you exactly how. - Adam`,
  6: `Hey [Name], after this I'm moving you to a waitlist — only take 2-3 new clients a month and I'm there. If you've been sitting on it, just reply. I'll send the video and we'll go from there. - Adam, Saltarelli Web Studio`,
  7: `Hey [Name], last one from me — I mean it this time 😅. If the timing ever works, you know where to find me. The video offer stands. Good luck out there. - Adam, Saltarelli Web Studio`,
};

/** Derive a friendly trade label from service_interest */
function deriveTrade(serviceInterest: string | null): string {
  if (!serviceInterest) return "trades";
  const si = serviceInterest.toLowerCase();
  if (si.includes("concrete") || si.includes("paving") || si.includes("masonry")) return "concrete";
  if (si.includes("landscap")) return "landscaping";
  if (si.includes("plumb")) return "plumbing";
  if (si.includes("electr")) return "electrical";
  if (si.includes("hvac") || si.includes("heat") || si.includes("cool")) return "HVAC";
  if (si.includes("roofing") || si.includes("roof")) return "roofing";
  if (si.includes("paint")) return "painting";
  if (si.includes("clean")) return "cleaning";
  if (si.includes("construct")) return "construction";
  if (si.includes("fitness") || si.includes("gym")) return "fitness";
  if (si.includes("restaurant") || si.includes("food")) return "restaurant";
  return serviceInterest.split(",")[0].trim().toLowerCase();
}

/** Normalise a phone number to E.164 format (+1XXXXXXXXXX for North American numbers) */
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
  const trade = deriveTrade(lead.service_interest);
  return template.replace(/\[Name\]/g, firstName).replace(/\[trade\]/g, trade);
}

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

      if (nextStep > 7) {
        results.skipped++;
        continue;
      }

      // Normalise phone
      const normalisedPhone = normalisePhone(lead.phone);
      if (!normalisedPhone) {
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
