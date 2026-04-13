import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyCronOrAdmin } from "../_shared/auth.ts";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

// 3-step review drip: friendly → persistent
const REVIEW_TEMPLATES: Record<number, string> = {
  1: `Hey [Name]! Thanks for choosing Saltarelli Web Studio. If you have a sec, a Google review would mean the world: [LINK] - Adam`,
  2: `Hey [Name], quick reminder — if you haven't had a chance yet, dropping a Google review would really help us out: [LINK]`,
  3: `[Name], last ask! A 30-second Google review goes a long way for a small business like ours. Would really appreciate it: [LINK]`,
};

/** Normalise a phone number to E.164 format (+1XXXXXXXXXX for North American numbers) */
function normalisePhone(raw: string): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

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
    const { lead_id, recipient_name, recipient_phone, step } = await req.json();

    if (!lead_id || !recipient_name || !recipient_phone || !step) {
      return new Response(
        JSON.stringify({ error: "lead_id, recipient_name, recipient_phone, and step are required" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const template = REVIEW_TEMPLATES[step];
    if (!template) {
      return new Response(
        JSON.stringify({ error: `Invalid step: ${step}. Only steps 1-3 are supported.` }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Fetch google_place_id + OpenPhone credentials from integration_settings
    const { data: settings } = await supabase
      .from("integration_settings")
      .select("key, value")
      .in("key", ["google_place_id", "openphone_api_key", "openphone_phone_number_id"]);

    const settingsMap = new Map(settings?.map((s: { key: string; value: string }) => [s.key, s.value]) || []);
    const placeId = settingsMap.get("google_place_id");
    const apiKey = settingsMap.get("openphone_api_key");
    const phoneNumberId = settingsMap.get("openphone_phone_number_id");

    if (!placeId) {
      return new Response(
        JSON.stringify({ error: "Google Place ID not configured in integration settings" }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    if (!apiKey || !phoneNumberId) {
      return new Response(
        JSON.stringify({ error: "OpenPhone credentials not configured" }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Build review URL and message
    const reviewUrl = `https://search.google.com/local/reviews?placeid=${placeId}`;
    const firstName = (recipient_name || "there").split(" ")[0].trim();
    const messageBody = template
      .replace(/\[Name\]/g, firstName)
      .replace(/\[LINK\]/g, reviewUrl);

    // Normalise phone
    const normalisedPhone = normalisePhone(recipient_phone);
    if (!normalisedPhone) {
      await supabase.from("review_requests").insert({
        lead_id,
        step,
        recipient_name,
        recipient_phone,
        google_place_id: placeId,
        review_url: reviewUrl,
        message_body: messageBody,
        status: "failed",
        error_message: `Invalid phone number: ${recipient_phone}`,
      });

      return new Response(
        JSON.stringify({ error: `Invalid phone number: ${recipient_phone}` }),
        { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Check for duplicate send (prevent double-sends)
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: existingLog } = await supabase
      .from("review_requests")
      .select("id, status")
      .eq("lead_id", lead_id)
      .eq("step", step)
      .or(`status.eq.sent,sent_at.gte.${fiveMinAgo}`)
      .limit(1)
      .maybeSingle();

    if (existingLog) {
      return new Response(
        JSON.stringify({ skipped: true, reason: `review step ${step} already sent or recently attempted` }),
        { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
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

    // Log to review_requests
    await supabase.from("review_requests").insert({
      lead_id,
      step,
      recipient_name,
      recipient_phone: normalisedPhone,
      google_place_id: placeId,
      review_url: reviewUrl,
      message_body: messageBody,
      status,
      openphone_message_id: openphoneMessageId,
      error_message: sendError,
    });

    // Update lead review drip step on success
    if (!sendError) {
      await supabase
        .from("admin_leads")
        .update({
          review_drip_step: step,
          review_drip_active: true,
        })
        .eq("id", lead_id);
    }

    return new Response(
      JSON.stringify({ success: !sendError, lead_id, step, status, error: sendError }),
      { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("send-review-sms error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
