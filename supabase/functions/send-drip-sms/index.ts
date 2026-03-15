import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// 7-step drip sequence: { step, delayDays, template }
// Day 0 = immediate, then 3, 7, 14, 21, 30, 45
const DRIP_SEQUENCE = [
  {
    step: 1,
    delayDays: 0,
    template: (name: string) =>
      `Hey ${name}! Thanks for your interest in Saltarelli Web Studio. We'd love to learn more about your project. When's a good time to chat?`,
  },
  {
    step: 2,
    delayDays: 3,
    template: (name: string) =>
      `Hi ${name}, just following up! We specialize in building modern web apps and automations for small businesses. Any questions we can answer?`,
  },
  {
    step: 3,
    delayDays: 7,
    template: (name: string) =>
      `Hey ${name}, quick check-in — still interested in leveling up your online presence? We have some availability opening up soon.`,
  },
  {
    step: 4,
    delayDays: 14,
    template: (name: string) =>
      `Hi ${name}! Just wanted to share that we recently helped a client launch their new site in under 2 weeks. Would love to do the same for you!`,
  },
  {
    step: 5,
    delayDays: 21,
    template: (name: string) =>
      `Hey ${name}, we're running a special this month for new clients. Want to hear the details? Just reply and we'll fill you in.`,
  },
  {
    step: 6,
    delayDays: 30,
    template: (name: string) =>
      `Hi ${name}, it's been a month since we first connected. If you're still thinking about a web project, we're here to help whenever you're ready!`,
  },
  {
    step: 7,
    delayDays: 45,
    template: (name: string) =>
      `Hey ${name}, just one last note — our door is always open if you decide to move forward. Feel free to reach out anytime. Best of luck!`,
  },
];

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
    if (lead.status === "closed" || lead.status === "client") {
      return new Response(
        JSON.stringify({ skipped: true, reason: `lead status is ${lead.status}` }),
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

    const firstName = lead.name.split(" ")[0];
    const messageBody = stepConfig.template(firstName);

    // Fetch OpenPhone credentials from integration_settings
    const { data: settings } = await supabase
      .from("integration_settings")
      .select("key, value")
      .in("key", ["openphone_api_key", "openphone_phone_number_id"]);

    const settingsMap = new Map(settings?.map((s: { key: string; value: string }) => [s.key, s.value]) || []);
    const apiKey = settingsMap.get("openphone_api_key");
    const phoneNumberId = settingsMap.get("openphone_phone_number_id");

    if (!apiKey || !phoneNumberId) {
      // Log the failure
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
