import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyCronOrAdmin } from "../_shared/auth.ts";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const PLANNER_URL = "https://adam-planner.vercel.app";
const PLANNER_SECRET = "cron_adam_planner_2026_secure_key";

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
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const today = new Date().toISOString().split("T")[0];
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Run all queries in parallel
    const [
      leadsRes,
      clientsRes,
      dripRes,
      closedRes,
      callLogsRes,
      pageViewsRes,
      siteEventsRes,
      contentRes,
      plannerRes,
    ] = await Promise.all([
      // 1. Active leads
      sb
        .from("admin_leads")
        .select(
          "id, name, business_name, phone, email, status, last_contacted_date, next_followup_date, demo_attended, drip_active, drip_step, drip_paused_at, created_at, closed_at, notes, service_interest, source"
        )
        .in("status", ["cold", "warm", "hot", "followed_up", "replied", "demo_booked"])
        .order("next_followup_date", { ascending: true }),

      // 2. Clients
      sb
        .from("pods")
        .select("id, name, company_name, contact_email, contact_phone, last_contacted_at, created_at"),

      // 3. Recent drip activity (last 48h)
      sb
        .from("sms_drip_log")
        .select("id, lead_id, step, sent_at, status, error_message")
        .gte("sent_at", twoDaysAgo)
        .order("sent_at", { ascending: false })
        .limit(50),

      // 4. Closed/converted leads
      sb
        .from("admin_leads")
        .select("id, name, status, closed_at, demo_attended")
        .in("status", ["client", "closed"]),

      // 5. Recent call logs (last 7 days, limit 20)
      sb
        .from("call_logs")
        .select("id, pod_id, call_started_at, call_status, direction, duration_seconds, caller_number, called_number, summary")
        .gte("call_started_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order("call_started_at", { ascending: false })
        .limit(20),

      // 6. Website page views (last 30 days, aggregated)
      sb
        .from("page_views")
        .select("session_id, device, created_at")
        .gte("created_at", thirtyDaysAgo),

      // 7. Site events (last 30 days)
      sb
        .from("site_events")
        .select("event, metadata, session_id, created_at")
        .gte("created_at", thirtyDaysAgo),

      // 8. Content posts (last 30 days)
      sb
        .from("content_posts")
        .select("id, platform, title, content_format, views, likes, comments, shares, posted_at, created_at")
        .gte("created_at", thirtyDaysAgo)
        .order("created_at", { ascending: false })
        .limit(20),

      // 9. Adam Planner schedule
      fetch(`${PLANNER_URL}/api/schedule`, {
        headers: { "x-api-secret": PLANNER_SECRET },
      })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]);

    const activeLeads = leadsRes.data || [];
    const clientList = clientsRes.data || [];
    const recentDrip = dripRes.data || [];
    const closedLeads = closedRes.data || [];
    const callLogs = callLogsRes.data || [];
    const pageViews = pageViewsRes.data || [];
    const siteEvents = siteEventsRes.data || [];
    const contentPosts = contentRes.data || [];

    // ── Compute alerts ──
    const alerts: string[] = [];

    // Stale leads (7+ days no contact)
    const staleLeads = activeLeads.filter((l) => {
      if (l.status === "cold") return false;
      if (!l.last_contacted_date) return true;
      const days = Math.floor(
        (Date.now() - new Date(l.last_contacted_date + "T00:00:00").getTime()) / 86400000
      );
      return days >= 7;
    });
    if (staleLeads.length > 0) {
      alerts.push(`${staleLeads.length} active lead(s) not contacted in 7+ days: ${staleLeads.slice(0, 5).map((l) => l.name).join(", ")}${staleLeads.length > 5 ? ` (+${staleLeads.length - 5} more)` : ""}`);
    }

    // Overdue follow-ups
    const overdue = activeLeads.filter((l) => l.next_followup_date && l.next_followup_date <= today);
    if (overdue.length > 0) {
      alerts.push(`${overdue.length} overdue follow-up(s): ${overdue.slice(0, 5).map((l) => l.name).join(", ")}${overdue.length > 5 ? ` (+${overdue.length - 5} more)` : ""}`);
    }

    // Replied but unresponded
    const repliedUnresponded = activeLeads.filter(
      (l) => l.status === "replied" && (!l.last_contacted_date || l.last_contacted_date < today)
    );
    if (repliedUnresponded.length > 0) {
      alerts.push(`${repliedUnresponded.length} replied lead(s) waiting for response: ${repliedUnresponded.map((l) => l.name).join(", ")}`);
    }

    // Demo no-shows
    const noShows = activeLeads.filter((l) => l.status === "demo_booked" && l.demo_attended === false);
    if (noShows.length > 0) {
      alerts.push(`${noShows.length} demo no-show(s): ${noShows.map((l) => l.name).join(", ")}`);
    }

    // Stale clients
    const staleClients = clientList.filter((c) => {
      if (!c.last_contacted_at) return true;
      return Math.floor((Date.now() - new Date(c.last_contacted_at).getTime()) / 86400000) >= 7;
    });
    if (staleClients.length > 0) {
      alerts.push(`${staleClients.length} client(s) not contacted in 7+ days: ${staleClients.map((c) => c.company_name || c.name).join(", ")}`);
    }

    // Drip failures
    const dripFailures = recentDrip.filter((d) => d.status === "failed");
    if (dripFailures.length > 0) {
      alerts.push(`${dripFailures.length} drip SMS failure(s) in last 48h`);
    }

    // ── Website analytics summary ──
    const uniqueSessions = new Set(pageViews.map((pv) => pv.session_id)).size;
    const deviceBreakdown: Record<string, number> = {};
    for (const pv of pageViews) {
      deviceBreakdown[pv.device || "unknown"] = (deviceBreakdown[pv.device || "unknown"] || 0) + 1;
    }

    const auditStarts = siteEvents.filter((e) => e.event === "audit_start").length;
    const auditCompletes = siteEvents.filter((e) => e.event === "audit_complete").length;
    const calendlyClicks = siteEvents.filter((e) => e.event === "calendly_click").length;
    const conversionRate = uniqueSessions > 0 ? ((auditCompletes / uniqueSessions) * 100).toFixed(1) : "0";

    // ── Call log summary ──
    const callSummary = {
      total_calls_7d: callLogs.length,
      completed: callLogs.filter((c) => c.call_status === "completed").length,
      missed: callLogs.filter((c) => c.call_status === "missed").length,
      inbound: callLogs.filter((c) => c.direction === "inbound").length,
      outbound: callLogs.filter((c) => c.direction === "outbound").length,
      recent: callLogs.slice(0, 5).map((c) => ({
        status: c.call_status,
        direction: c.direction,
        duration: c.duration_seconds,
        summary: c.summary?.substring(0, 100),
        when: c.call_started_at,
      })),
    };

    // ── Content summary ──
    const contentSummary = {
      posts_30d: contentPosts.length,
      total_views: contentPosts.reduce((s, p) => s + (p.views || 0), 0),
      total_likes: contentPosts.reduce((s, p) => s + (p.likes || 0), 0),
      by_platform: contentPosts.reduce((acc: Record<string, number>, p) => {
        acc[p.platform] = (acc[p.platform] || 0) + 1;
        return acc;
      }, {}),
      top_posts: contentPosts
        .sort((a, b) => (b.views || 0) - (a.views || 0))
        .slice(0, 3)
        .map((p) => ({ platform: p.platform, title: p.title, views: p.views, likes: p.likes })),
    };

    // ── Pipeline stats ──
    const stats = {
      total_active_leads: activeLeads.length,
      by_status: {
        cold: activeLeads.filter((l) => l.status === "cold").length,
        warm: activeLeads.filter((l) => l.status === "warm").length,
        hot: activeLeads.filter((l) => l.status === "hot").length,
        followed_up: activeLeads.filter((l) => l.status === "followed_up").length,
        replied: activeLeads.filter((l) => l.status === "replied").length,
        demo_booked: activeLeads.filter((l) => l.status === "demo_booked").length,
      },
      total_clients: clientList.length,
      total_converted: closedLeads.filter((l) => l.status === "client").length,
      total_closed_lost: closedLeads.filter((l) => l.status === "closed").length,
      drip_sends_48h: recentDrip.filter((d) => d.status === "sent").length,
      drip_failures_48h: dripFailures.length,
    };

    return new Response(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        stats,
        leads: activeLeads,
        clients: clientList,
        recent_drip: recentDrip,
        alerts,
        website: {
          page_views_30d: pageViews.length,
          unique_sessions_30d: uniqueSessions,
          device_breakdown: deviceBreakdown,
          audit_starts: auditStarts,
          audit_completes: auditCompletes,
          calendly_clicks: calendlyClicks,
          conversion_rate: conversionRate + "%",
        },
        calls: callSummary,
        content: contentSummary,
        planner: plannerRes || null,
      }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("sentinel-snapshot error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
