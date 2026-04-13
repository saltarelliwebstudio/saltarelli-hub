import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyCronOrAdmin } from "../_shared/auth.ts";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

// 3-step review drip delays (days since step 1 was sent)
const STEP_DELAYS: Record<number, number> = {
  1: 0,   // immediate (handled by send-review-sms directly)
  2: 3,   // 3 days after step 1
  3: 7,   // 7 days after step 1
};

const MAX_REVIEW_STEPS = 3;
const MAX_FAILURES = 3;

const REVIEW_TEMPLATES: Record<number, string> = {
  1: `Hey [Name]! Thanks for choosing Saltarelli Web Studio. If you have a sec, a Google review would mean the world: [LINK] - Adam`,
  2: `Hey [Name], quick reminder — if you haven't had a chance yet, dropping a Google review would really help us out: [LINK]`,
  3: `[Name], last ask! A 30-second Google review goes a long way for a small business like ours. Would really appreciate it: [LINK]`,
};

/** Normalise a phone number to E.164 format (+1XXXXXXXXXX) */
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

  const results = { processed: 0, sent: 0, skipped: 0, errors: 0, deactivated: 0, completed: 0 };

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Fetch eligible leads: review drip active, not paused, still has steps remaining
    const { data: leads, error: leadsError } = await supabase
      .from("admin_leads")
      .select("*")
      .eq("review_drip_active", true)
      .is("review_drip_paused_at", null)
      .lt("review_drip_step", MAX_REVIEW_STEPS)
      .gt("review_drip_step", 0); // step 0 = not started, step 1 sent immediately by send-review-sms

    if (leadsError) {
      console.error("Error fetching leads:", leadsError);
      return new Response(
        JSON.stringify({ error: leadsError.message }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    if (!leads || leads.length === 0) {
      return new Response(
        JSON.stringify({ ...results, message: "No eligible leads for review drip" }),
        { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Fetch settings: google_place_id + OpenPhone credentials
    const { data: settings } = await supabase
      .from("integration_settings")
      .select("key, value")
      .in("key", ["google_place_id", "openphone_api_key", "openphone_phone_number_id"]);

    const settingsMap = new Map(settings?.map((s: { key: string; value: string }) => [s.key, s.value]) || []);
    const placeId = settingsMap.get("google_place_id");
    const apiKey = settingsMap.get("openphone_api_key");
    const phoneNumberId = settingsMap.get("openphone_phone_number_id");

    if (!placeId || !apiKey || !phoneNumberId) {
      return new Response(
        JSON.stringify({ error: "Missing google_place_id or OpenPhone credentials" }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const reviewUrl = `https://search.google.com/local/reviews?placeid=${placeId}`;
    const now = new Date();

    for (const lead of leads) {
      results.processed++;
      const nextStep = (lead.review_drip_step || 0) + 1;

      if (nextStep > MAX_REVIEW_STEPS) {
        results.skipped++;
        continue;
      }

      // Validate phone
      const normalisedPhone = normalisePhone(lead.phone);
      if (!normalisedPhone) {
        await supabase
          .from("admin_leads")
          .update({ review_drip_active: false })
          .eq("id", lead.id);
        results.deactivated++;
        continue;
      }

      // Check failure count for this step
      const { count: failCount } = await supabase
        .from("review_requests")
        .select("id", { count: "exact", head: true })
        .eq("lead_id", lead.id)
        .eq("step", nextStep)
        .eq("status", "failed");

      if ((failCount || 0) >= MAX_FAILURES) {
        await supabase
          .from("admin_leads")
          .update({ review_drip_active: false })
          .eq("id", lead.id);
        results.deactivated++;
        continue;
      }

      // Daily rate-limit: skip if already attempted today
      const todayStart = new Date(now);
      todayStart.setUTCHours(0, 0, 0, 0);
      const { data: todayAttempt } = await supabase
        .from("review_requests")
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

      // Check delay requirement: days since step 1 was sent
      const { data: step1Log } = await supabase
        .from("review_requests")
        .select("sent_at")
        .eq("lead_id", lead.id)
        .eq("step", 1)
        .eq("status", "sent")
        .order("sent_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!step1Log) {
        results.skipped++;
        continue;
      }

      const step1SentAt = new Date(step1Log.sent_at);
      const daysSinceStep1 = Math.floor((now.getTime() - step1SentAt.getTime()) / (1000 * 60 * 60 * 24));
      const requiredDelay = STEP_DELAYS[nextStep] || 0;

      if (daysSinceStep1 < requiredDelay) {
        results.skipped++;
        continue;
      }

      // Check for duplicate successful send
      const { data: existingLog } = await supabase
        .from("review_requests")
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
      const template = REVIEW_TEMPLATES[nextStep];
      if (!template) {
        results.skipped++;
        continue;
      }

      const firstName = (lead.name || "there").split(" ")[0].trim();
      const messageBody = template
        .replace(/\[Name\]/g, firstName)
        .replace(/\[LINK\]/g, reviewUrl);

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

      // Detect permanent failures
      const PERMANENT_ERRORS = ["input was invalid", "Opted Out", "not approved for A2P", "number is not valid", "unreachable"];
      const isPermanent = sendError && PERMANENT_ERRORS.some(e => sendError!.includes(e));
      const status = sendError ? "failed" : "sent";

      // Log to review_requests
      await supabase.from("review_requests").insert({
        lead_id: lead.id,
        step: nextStep,
        recipient_name: lead.name,
        recipient_phone: normalisedPhone,
        google_place_id: placeId,
        review_url: reviewUrl,
        message_body: messageBody,
        status,
        openphone_message_id: openphoneMessageId,
        error_message: sendError,
      });

      if (!sendError) {
        const isLastStep = nextStep >= MAX_REVIEW_STEPS;
        await supabase
          .from("admin_leads")
          .update({
            review_drip_step: nextStep,
            // Auto-deactivate after final step
            ...(isLastStep ? { review_drip_active: false } : {}),
          })
          .eq("id", lead.id);

        if (isLastStep) {
          results.completed++;
        }
        results.sent++;
      } else if (isPermanent) {
        await supabase
          .from("admin_leads")
          .update({ review_drip_active: false })
          .eq("id", lead.id);
        results.deactivated++;
      } else {
        console.error(`Review send failed for lead ${lead.id} step ${nextStep}:`, sendError);
        results.errors++;
      }
    }

    console.log("Review queue processed:", results);

    return new Response(
      JSON.stringify(results),
      { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("process-review-queue error:", message);
    return new Response(
      JSON.stringify({ error: message, ...results }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
