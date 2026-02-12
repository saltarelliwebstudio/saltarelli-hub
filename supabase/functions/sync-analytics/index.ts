import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SyncAnalyticsRequest {
  client_id: string;
  force?: boolean;
}

// Adapter interface for different analytics sources
interface AnalyticsAdapter {
  sync(
    supabase: ReturnType<typeof createClient>,
    clientId: string,
    config: Record<string, unknown>
  ): Promise<{ metrics_synced: number }>;
}

// Manual adapter — reads existing cached data (no external fetch)
const manualAdapter: AnalyticsAdapter = {
  async sync(supabase, clientId, _config) {
    // Manual data is entered directly by admin; nothing to sync
    return { metrics_synced: 0 };
  },
};

// Vercel adapter — TODO: implement when Vercel API token is configured
const vercelAdapter: AnalyticsAdapter = {
  async sync(_supabase, _clientId, _config) {
    // TODO: Implement Vercel Analytics API integration
    // Requires VERCEL_API_TOKEN in env and project_id in config
    console.log("Vercel analytics adapter not yet implemented");
    return { metrics_synced: 0 };
  },
};

// Google Analytics adapter — TODO: implement
const googleAnalyticsAdapter: AnalyticsAdapter = {
  async sync(_supabase, _clientId, _config) {
    // TODO: Implement Google Analytics Data API integration
    console.log("Google Analytics adapter not yet implemented");
    return { metrics_synced: 0 };
  },
};

const adapters: Record<string, AnalyticsAdapter> = {
  manual: manualAdapter,
  vercel: vercelAdapter,
  google_analytics: googleAnalyticsAdapter,
  custom: manualAdapter, // custom uses same pattern as manual for now
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { client_id, force }: SyncAnalyticsRequest = await req.json();

    if (!client_id) {
      return new Response(
        JSON.stringify({ error: "client_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Fetch analytics config for this client
    const { data: configs, error: configError } = await supabaseAdmin
      .from("client_analytics_config")
      .select("*")
      .eq("client_id", client_id)
      .eq("is_active", true);

    if (configError) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch analytics config: " + configError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!configs || configs.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active analytics config found", metrics_synced: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalMetricsSynced = 0;

    for (const config of configs) {
      const adapter = adapters[config.source_type];
      if (!adapter) {
        console.error(`No adapter found for source type: ${config.source_type}`);
        continue;
      }

      const result = await adapter.sync(supabaseAdmin, client_id, config.config || {});
      totalMetricsSynced += result.metrics_synced;
    }

    return new Response(
      JSON.stringify({
        success: true,
        metrics_synced: totalMetricsSynced,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Sync analytics error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
