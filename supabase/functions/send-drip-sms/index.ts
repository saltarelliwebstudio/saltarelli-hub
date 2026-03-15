import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// 7-step drip sequence matching the original Saltarelli Web Studio campaign
// Template variables: [Name] = first name, [trade] = derived from service_interest
const DRIP_SEQUENCE = [
  {
    step: 1,
    delayDays: 0,
    template: `Hey [Name], Adam from Saltarelli Web Studio here in Niagara. I recently helped Zach Melnyk at Melnyk Concrete get back 5+ hours a week with a simple AI automation. Worth a quick chat?`,
  },
  {
    step: 2,
    delayDays: 3,
    template: `Hey [Name], just following up — I know you're busy on the tools. If you ever want to see how other [trade] businesses are saving 5+ hours a week on admin, I'm happy to show you a quick demo. No pressure.`,
  },
  {
    step: 3,
    delayDays: 7,
    template: `Hey [Name], quick thought — what if every missed call turned into a booked job automatically? That's what we set up for trades businesses like yours. Want me to show you how it works? Takes 10 min.`,
  },
  {
    step: 4,
    delayDays: 14,
    template: `Hey [Name], Adam here. Just wanted to check in — still happy to show you how we help [trade] businesses cut their admin time in half. Let me know if you'd like a quick walkthrough.`,
  },
  {
    step: 5,
    delayDays: 21,
    template: `Hey [Name], one more thought — we just helped a concrete company in Niagara automate their entire quote follow-up process. Saved them hours every week. If that sounds useful, I'd love to chat.`,
  },
  {
    step: 6,
    delayDays: 30,
    template: `Hey [Name], Adam from Saltarelli Web Studio. I know timing is everything — whenever you're ready to look at automating some of the admin side of your business, I'm here. Just reply and we'll set something up.`,
  },
  {
    step: 7,
    delayDays: 45,
    template: `Hey [Name], last note from me — if you ever want to explore how apps and automations can help your business run smoother, my door's always open. All the best! - Adam, Saltarelli Web Studio`,
  },
];

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
  return null; // international or invalid
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
        JSON.stringify({ error: `Invalid step: ${step}` }),
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
