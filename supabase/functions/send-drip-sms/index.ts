import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// 7-step audit drip: inbound leads who completed the After-Hours Audit
const DRIP_SEQUENCE = [
  {
    step: 1,
    delayDays: 0,
    template: `Hey [Name]! Saw you took the After-Hours Audit — looks like you might be losing $[Leak]/yr and [Hours] hrs/yr to missed calls and admin work. I build systems to fix exactly that. Does that sound about right? - Adam, Saltarelli Web Studio`,
  },
  {
    step: 2,
    delayDays: 3,
    template: `Hey [Name], just circling back. I'm not reaching out to push anything — I genuinely think I can help based on your audit results. Just reply and I'll send over a quick case study of how I solved the exact same problem for another local business. - Adam`,
  },
  {
    step: 3,
    delayDays: 7,
    template: `Me waiting for you to respond 😅 — but seriously [Name], just reply. 60 seconds, that's it. - Adam`,
  },
  {
    step: 4,
    delayDays: 14,
    template: `Hey [Name]… it's me again. Had two businesses sign on this week so I'm filling up fast — but I kept a spot open with you in mind. Still interested? - Adam`,
  },
  {
    step: 5,
    delayDays: 21,
    template: `Hey [Name], it's Adam. Almost fully booked for the season but I made sure to leave one spot open. Reply soon and I'll show you exactly how I can help before it's gone. - Adam`,
  },
  {
    step: 6,
    delayDays: 30,
    template: `Hey [Name], after this I'm moving you to a waitlist — I only take 2-3 new clients a month and I'm there. Now's the time. Just reply. - Adam, Saltarelli Web Studio`,
  },
  {
    step: 7,
    delayDays: 45,
    template: `Hey [Name], last one from me — I mean it this time 😅. If the timing ever works, you know where to find me. Good luck out there. - Adam, Saltarelli Web Studio`,
  },
];

/** Normalise a phone number to E.164 format (+1XXXXXXXXXX for North American numbers) */
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

  try {
    const { lead_id, step } = await req.json();

    if (!lead_id || !step) {
      return new Response(
        JSON.stringify({ error: "lead_id and step are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Fetch the lead
    const { data: lead, error: leadError } = await supabase
      .from("admin_leads")
      .select("*")
      .eq("id", lead_id)
      .single();

    if (leadError || !lead) {
      return new Response(
        JSON.stringify({ error: "Lead not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Guards
    if (!lead.drip_active) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "drip_active is false" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (lead.drip_paused_at) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "drip is paused" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!lead.phone) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "no phone number" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (lead.status === "closed" || lead.status === "client" || lead.status === "do_not_contact") {
      return new Response(
        JSON.stringify({ skipped: true, reason: `lead status is ${lead.status}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalise phone to E.164
    const normalisedPhone = normalisePhone(lead.phone);
    if (!normalisedPhone) {
      // Invalid phone — deactivate drip
      await supabase
        .from("admin_leads")
        .update({ drip_active: false })
        .eq("id", lead_id);

      return new Response(
        JSON.stringify({ skipped: true, reason: `invalid phone number: ${lead.phone}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if this step was already sent
    const { data: existingLog } = await supabase
      .from("sms_drip_log")
      .select("id")
      .eq("lead_id", lead_id)
      .eq("step", step)
      .eq("status", "sent")
      .maybeSingle();

    if (existingLog) {
      return new Response(
        JSON.stringify({ skipped: true, reason: `step ${step} already sent` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the template
    const stepConfig = DRIP_SEQUENCE.find((s) => s.step === step);
    if (!stepConfig) {
      return new Response(
        JSON.stringify({ error: `Invalid step: ${step}. Only steps 1-7 are supported.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const messageBody = buildMessage(stepConfig.template, lead);

    // Fetch OpenPhone credentials from integration_settings
    const { data: settings } = await supabase
      .from("integration_settings")
      .select("key, value")
      .in("key", ["openphone_api_key", "openphone_phone_number_id"]);

    const settingsMap = new Map(settings?.map((s: { key: string; value: string }) => [s.key, s.value]) || []);
    const apiKey = settingsMap.get("openphone_api_key");
    const phoneNumberId = settingsMap.get("openphone_phone_number_id");

    if (!apiKey || !phoneNumberId) {
      await supabase.from("sms_drip_log").insert({
        lead_id,
        step,
        message_body: messageBody,
        status: "failed",
        error_message: "OpenPhone credentials not configured in integration_settings",
      });

      return new Response(
        JSON.stringify({ error: "OpenPhone credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send via OpenPhone API
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

    // Log to sms_drip_log
    await supabase.from("sms_drip_log").insert({
      lead_id,
      step,
      message_body: messageBody,
      status,
      openphone_message_id: openphoneMessageId,
      error_message: sendError,
    });

    // Update lead
    if (!sendError) {
      await supabase
        .from("admin_leads")
        .update({
          drip_step: step,
          last_contacted_date: new Date().toISOString().split("T")[0],
        })
        .eq("id", lead_id);
    }

    return new Response(
      JSON.stringify({ success: !sendError, lead_id, step, status, error: sendError }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("send-drip-sms error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
