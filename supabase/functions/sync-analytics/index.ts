import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAdmin } from "../_shared/auth.ts";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsOptions(req);
  }

  const authCheck = await verifyAdmin(req);
  if (authCheck.error) {
    return new Response(JSON.stringify({ error: authCheck.error }), {
      status: 401,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }

  try {
    const { client_id }: { client_id: string } = await req.json();

    if (!client_id) {
      return new Response(
        JSON.stringify({ error: "client_id is required" }),
        {
          status: 400,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        }
      );
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const now = new Date();
    const ranges = [
      { days: 7, label: "7d" },
      { days: 30, label: "30d" },
      { days: 90, label: "90d" },
    ];

    let totalMetricsSynced = 0;

    for (const range of ranges) {
      const start = new Date(
        now.getTime() - range.days * 24 * 60 * 60 * 1000
      );
      const startISO = start.toISOString();
      const endISO = now.toISOString();

      // Fetch raw page views
      const { data: pageViews } = await sb
        .from("page_views")
        .select("path, session_id, device, browser, country, created_at")
        .gte("created_at", startISO);

      const pvList = pageViews || [];
      const totalViews = pvList.length;
      const uniqueSessions = new Set(pvList.map((pv) => pv.session_id)).size;

      // Bounce rate: sessions with only 1 page view
      const sessionCounts: Record<string, number> = {};
      for (const pv of pvList) {
        sessionCounts[pv.session_id] = (sessionCounts[pv.session_id] || 0) + 1;
      }
      const totalSessions = Object.keys(sessionCounts).length;
      const singlePageSessions = Object.values(sessionCounts).filter(
        (c) => c === 1
      ).length;
      const bounceRate =
        totalSessions > 0
          ? Math.round((singlePageSessions / totalSessions) * 100)
          : 0;

      // Top pages
      const pageCounts: Record<string, number> = {};
      for (const pv of pvList) {
        pageCounts[pv.path] = (pageCounts[pv.path] || 0) + 1;
      }
      const topPages = Object.entries(pageCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([page, views]) => ({ page, views }));

      // Device breakdown
      const devices: Record<string, number> = {};
      for (const pv of pvList) {
        devices[pv.device || "unknown"] =
          (devices[pv.device || "unknown"] || 0) + 1;
      }

      // Browser breakdown
      const browsers: Record<string, number> = {};
      for (const pv of pvList) {
        browsers[pv.browser || "unknown"] =
          (browsers[pv.browser || "unknown"] || 0) + 1;
      }

      // Referrer breakdown
      const referrers: Record<string, number> = {};
      for (const pv of pvList) {
        const ref = (pv as any).referrer;
        if (ref) {
          try {
            const host = new URL(ref).hostname;
            referrers[host] = (referrers[host] || 0) + 1;
          } catch {
            referrers[ref] = (referrers[ref] || 0) + 1;
          }
        }
      }

      // Daily stats for chart
      const dailyCounts: Record<
        string,
        { views: number; sessions: Set<string> }
      > = {};
      for (const pv of pvList) {
        const day = pv.created_at.split("T")[0];
        if (!dailyCounts[day])
          dailyCounts[day] = { views: 0, sessions: new Set() };
        dailyCounts[day].views++;
        dailyCounts[day].sessions.add(pv.session_id);
      }

      // Fetch site events
      const { data: siteEvents } = await sb
        .from("site_events")
        .select("event, metadata, session_id, created_at")
        .gte("created_at", startISO);

      const evtList = siteEvents || [];

      // Event counts
      const eventCounts: Record<string, number> = {};
      for (const e of evtList) {
        eventCounts[e.event] = (eventCounts[e.event] || 0) + 1;
      }

      // CTA click breakdown (by label)
      const ctaClicks: Record<string, number> = {};
      for (const e of evtList) {
        if (e.event === "cta_click" && e.metadata?.label) {
          ctaClicks[e.metadata.label] =
            (ctaClicks[e.metadata.label] || 0) + 1;
        }
      }

      // Avg time on page (from time_on_page events, take max seconds per session)
      const sessionMaxTime: Record<string, number> = {};
      for (const e of evtList) {
        if (e.event === "time_on_page" && e.metadata?.seconds) {
          const sid = e.session_id;
          sessionMaxTime[sid] = Math.max(
            sessionMaxTime[sid] || 0,
            e.metadata.seconds
          );
        }
      }
      const timeValues = Object.values(sessionMaxTime);
      const avgTimeOnSite =
        timeValues.length > 0
          ? Math.round(
              timeValues.reduce((a, b) => a + b, 0) / timeValues.length
            )
          : 0;

      // Conversion funnel
      const auditStarts = eventCounts["audit_start"] || 0;
      const auditCompletes = eventCounts["audit_complete"] || 0;
      const calendlyClicks = eventCounts["calendly_click"] || 0;
      const conversionRate =
        uniqueSessions > 0
          ? ((auditCompletes / uniqueSessions) * 100).toFixed(1)
          : "0";

      // Upsert metrics
      const periodStart = startISO;
      const periodEnd = endISO;

      const metrics = [
        {
          metric_name: "page_views",
          metric_value: { count: totalViews },
        },
        {
          metric_name: "unique_visitors",
          metric_value: { count: uniqueSessions },
        },
        { metric_name: "bounce_rate", metric_value: { rate: bounceRate } },
        { metric_name: "top_pages", metric_value: topPages },
        { metric_name: "devices", metric_value: devices },
        { metric_name: "browsers", metric_value: browsers },
        { metric_name: "referrers", metric_value: referrers },
        {
          metric_name: "conversion_funnel",
          metric_value: {
            visitors: uniqueSessions,
            audit_starts: auditStarts,
            audit_completes: auditCompletes,
            calendly_clicks: calendlyClicks,
            conversion_rate: conversionRate + "%",
          },
        },
        {
          metric_name: "engagement",
          metric_value: {
            avg_time_on_site: avgTimeOnSite,
            visitor_to_audit_rate:
              uniqueSessions > 0
                ? ((auditStarts / uniqueSessions) * 100).toFixed(1) + "%"
                : "0%",
          },
        },
        { metric_name: "event_counts", metric_value: eventCounts },
        { metric_name: "cta_clicks", metric_value: ctaClicks },
      ];

      // Daily stats rows
      for (const [day, data] of Object.entries(dailyCounts)) {
        metrics.push({
          metric_name: "daily_stats",
          metric_value: {
            date: day,
            views: data.views,
            visitors: data.sessions.size,
          },
        });
      }

      // Delete old data for this range, then insert fresh
      await sb
        .from("client_analytics_data")
        .delete()
        .eq("client_id", client_id)
        .eq("source_type", `raw_${range.label}`);

      const rows = metrics.map((m) => ({
        client_id,
        source_type: `raw_${range.label}`,
        metric_name: m.metric_name,
        metric_value: m.metric_value,
        period_start: periodStart,
        period_end: periodEnd,
        synced_at: now.toISOString(),
      }));

      const { error: insertError } = await sb
        .from("client_analytics_data")
        .insert(rows);

      if (insertError) {
        console.error(`Insert error for ${range.label}:`, insertError.message);
      } else {
        totalMetricsSynced += rows.length;
      }
    }

    return new Response(
      JSON.stringify({ success: true, metrics_synced: totalMetricsSynced }),
      {
        status: 200,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Sync analytics error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
