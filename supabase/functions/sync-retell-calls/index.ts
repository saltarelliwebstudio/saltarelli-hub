import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RetellCall {
  call_id: string;
  agent_id: string;
  from_number?: string;
  to_number?: string;
  direction?: string;
  duration_ms?: number;
  status?: string;
  transcript?: string;
  recording_url?: string;
  start_timestamp?: number;
  call_analysis?: {
    call_summary?: string;
  };
  metadata?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pod_id } = await req.json().catch(() => ({}));

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Build query for retell accounts
    let query = supabaseAdmin
      .from("retell_accounts")
      .select("*")
      .eq("is_active", true);

    if (pod_id) {
      query = query.eq("pod_id", pod_id);
    }

    const { data: accounts, error: accountsError } = await query;

    if (accountsError) {
      console.error("Error fetching retell accounts:", accountsError);
      return new Response(
        JSON.stringify({ error: accountsError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!accounts || accounts.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active Retell accounts found", synced: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = {
      total_accounts: accounts.length,
      successful: 0,
      failed: 0,
      calls_synced: 0,
      calls_updated: 0,
      errors: [] as string[],
    };

    // Process each Retell account
    for (const account of accounts) {
      try {
        // Call Retell API to list calls
        const response = await fetch("https://api.retellai.com/v2/list-calls", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${account.retell_api_key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            agent_id: account.retell_agent_id,
            limit: 1000,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Retell API error for account ${account.id}:`, errorText);
          results.failed++;
          results.errors.push(`Account ${account.label}: ${response.status} - ${errorText}`);
          continue;
        }

        const calls: RetellCall[] = await response.json();

        // Process each call
        for (const call of calls) {
          // Check if call already exists
          const { data: existingCall } = await supabaseAdmin
            .from("call_logs")
            .select("id, retell_call_id")
            .eq("retell_call_id", call.call_id)
            .maybeSingle();

          // Parse transcript if it's an array
          let transcriptText = "";
          if (call.transcript) {
            if (typeof call.transcript === "string") {
              transcriptText = call.transcript;
            } else if (Array.isArray(call.transcript)) {
              transcriptText = (call.transcript as Array<{ role?: string; content?: string }>)
                .map((t) => `${t.role || "Unknown"}: ${t.content || ""}`)
                .join("\n");
            }
          }

          // Map call status
          let callStatus = "completed";
          if (call.status) {
            const statusLower = call.status.toLowerCase();
            if (statusLower.includes("miss") || statusLower === "no-answer") {
              callStatus = "missed";
            } else if (statusLower.includes("fail") || statusLower === "error") {
              callStatus = "failed";
            } else if (statusLower.includes("voicemail")) {
              callStatus = "voicemail";
            }
          }

          const callData = {
            pod_id: account.pod_id,
            retell_account_id: account.id,
            retell_call_id: call.call_id,
            caller_number: call.from_number || null,
            called_number: call.to_number || null,
            direction: call.direction?.toLowerCase() || "inbound",
            duration_seconds: call.duration_ms ? Math.round(call.duration_ms / 1000) : 0,
            call_status: callStatus,
            transcript: transcriptText || null,
            recording_url: call.recording_url || null,
            summary: call.call_analysis?.call_summary || null,
            call_started_at: call.start_timestamp
              ? new Date(call.start_timestamp).toISOString()
              : null,
            metadata: call.metadata || {},
          };

          if (existingCall) {
            // Update existing call
            const { error: updateError } = await supabaseAdmin
              .from("call_logs")
              .update({
                transcript: callData.transcript,
                recording_url: callData.recording_url,
                call_status: callData.call_status,
                summary: callData.summary,
                duration_seconds: callData.duration_seconds,
              })
              .eq("id", existingCall.id);

            if (updateError) {
              console.error("Error updating call:", updateError);
            } else {
              results.calls_updated++;
            }
          } else {
            // Insert new call
            const { error: insertError } = await supabaseAdmin
              .from("call_logs")
              .insert(callData);

            if (insertError) {
              console.error("Error inserting call:", insertError);
            } else {
              results.calls_synced++;
            }
          }
        }

        // Update last synced timestamp
        await supabaseAdmin
          .from("retell_accounts")
          .update({ last_synced_at: new Date().toISOString() })
          .eq("id", account.id);

        results.successful++;
      } catch (error) {
        console.error(`Error processing account ${account.id}:`, error);
        results.failed++;
        results.errors.push(`Account ${account.label}: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        ...results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Sync error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
