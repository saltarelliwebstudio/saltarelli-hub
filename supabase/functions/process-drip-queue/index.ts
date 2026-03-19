import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// 7-step audit drip sequence
const STEP_DELAYS: Record<number, number> = {
  1: 0,   // immediate
  2: 3,
  3: 7,
  4: 14,
  5: 21,
  6: 30,
  7: 45,
};

const MAX_STEPS = 7;
const MAX_FAILURES = 3; // deactivate drip after 3 failures per step

const DRIP_TEMPLATES: Record<number, string> = {
  1: `Hey [Name]! Saw you took the After-Hours Audit — looks like you might be losing $[Leak]/yr and [Hours] hrs/yr to missed calls and admin work. I build systems to fix exactly that. Does that sound about right? - Adam, Saltarelli Web Studio`,
  2: `Hey [Name], just circling back. I'm not reaching out to push anything — I genuinely think I can help based on your audit results. Just reply and I'll send over a quick case study of how I solved the exact same problem for another local business. - Adam`,
  3: `Me waiting for you to respond 😅 — but seriously [Name], just reply. 60 seconds, that's it. - Adam`,
  4: `Hey [Name]… it's me again. Had two businesses sign on this week so I'm filling up fast — but I kept a spot open with you in mind. Still interested? - Adam`,
  5: `Hey [Name], it's Adam. Almost fully booked for the season but I made sure to leave one spot open. Reply soon and I'll show you exactly how I can help before it's gone. - Adam`,
  6: `Hey [Name], after this I'm moving you to a waitlist — I only take 2-3 new clients a month and I'm there. Now's the time. Just reply. - Adam, Saltarelli Web Studio`,
  7: `Hey [Name], last one from me — I mean it this time 😅. If the timing ever works, you know where to find me. Good luck out there. - Adam, Saltarelli Web Studio`,
};

/** Normalise a phone number to E.164 format (+1XXXXXXXXXX) */
function normalisePhone(raw: string): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

/** Parse audit values from lead notes (Score, Revenue Leak, Hours Lost) */
function parseAuditNotes(notes: string | null): { score: string; leak: string; hours: string } {
  if (!notes) return { score: "0", leak: "0", hours: "0" };
  const scoreMatch = notes.match(/Score:\s*(\d+)/);
  const leakMatch = notes.match(/Revenue Leak:\s*\$([0-9,]+)/);
  const hoursMatch = notes.match(/Hours Lost:\s*(\d+)/);
  return {
    score: scoreMatch?.[1] || "0",
    leak: leakMatch?.[1] || "0",
    hours: hoursMatch?.[1] || "0",
  };
}

/** Build personalised message from template + lead */
function buildMessage(template: string, lead: { name: string; notes: string | null }): string {
  const firstName = (lead.name || "there").split(" ")[0].trim();
  const { leak, hours } = parseAuditNotes(lead.notes);
  return template
    .replace(/\[Name\]/g, firstName)
    .replace(/\[Leak\]/g, leak)
    .replace(/\[Hours\]/g, hours);
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

      // Daily rate-limit: skip if already attempted this lead+step today
      const todayStart = new Date(now);
      todayStart.setUTCHours(0, 0, 0, 0);
      const { data: todayAttempt } = await supabase
        .from("sms_drip_log")
        .select("id")
        .eq("lead_id", lead.id)
        .eq("step", nextStep)
        .gte("sent_at", todayStart.toISOString())
        .limit(1)
        .maybeSingle();

      if (todayAttempt) {
        results.skipped++;
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
