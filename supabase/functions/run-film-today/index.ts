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

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  let runId: string | null = null;
  const logs: string[] = [];

  async function appendLog(line: string) {
    logs.push(line);
    if (runId) {
      await sb.from("skill_runs").update({ logs }).eq("id", runId);
    }
  }

  async function failRun(error: string) {
    await appendLog(`[ERROR] ${error}`);
    if (runId) {
      await sb.from("skill_runs").update({
        status: "failed",
        logs,
        completed_at: new Date().toISOString(),
      }).eq("id", runId);
    }
  }

  try {
    const { run_id } = await req.json();
    runId = run_id;

    if (!runId) {
      return new Response(
        JSON.stringify({ error: "run_id is required" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const { data: runCheck } = await sb.from("skill_runs").select("status").eq("id", runId).single();
    if (runCheck?.status === "stopped") {
      return new Response(JSON.stringify({ ok: true, stopped: true }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      await failRun("ANTHROPIC_API_KEY not set in Supabase Edge Function secrets.");
      return new Response(
        JSON.stringify({ error: "Anthropic key missing" }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // --- Step 1: Pull content ideas ---
    await appendLog("[INFO] Loading content ideas from database...");

    const { data: ideas } = await sb
      .from("content_ideas")
      .select("*")
      .in("status", ["new", "approved"])
      .order("score", { ascending: false })
      .limit(10);

    const ideaCount = ideas?.length || 0;
    await appendLog(`[DATA] Found ${ideaCount} unfilmed content ideas`);

    // --- Step 2: Pull recent IG performance ---
    await appendLog("[INFO] Loading recent Instagram performance...");

    const { data: igPosts } = await sb
      .from("social_posts")
      .select("caption,media_type,like_count,comments_count,timestamp")
      .order("timestamp", { ascending: false })
      .limit(20);

    const { data: contentPosts } = await sb
      .from("content_posts")
      .select("title,topic,hook,content_format,views,likes,comments,shares,saves")
      .order("posted_at", { ascending: false })
      .limit(10);

    const totalData = (igPosts?.length || 0) + (contentPosts?.length || 0);
    await appendLog(`[DATA] Loaded ${totalData} recent posts for context`);

    // Check if stopped
    const { data: midCheck } = await sb.from("skill_runs").select("status").eq("id", runId).single();
    if (midCheck?.status === "stopped") {
      await appendLog("[STOPPED] Run cancelled by user.");
      return new Response(JSON.stringify({ ok: true, stopped: true }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // --- Step 3: Ask Claude what to film today ---
    await appendLog("[INFO] Analyzing data and generating film recommendations...");

    const contextData = JSON.stringify({
      ideas: ideas || [],
      recentIG: igPosts?.slice(0, 10) || [],
      recentContent: contentPosts?.slice(0, 5) || [],
    });

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2000,
        system: `You are Adam Saltarelli's content strategist. Adam is a 17-year-old solo founder running Saltarelli Web Studio in the Niagara region.

Your job: Given his content ideas and recent performance data, tell him exactly what to film TODAY.

Be specific and actionable. Give him:
1. The #1 video to film right now (with exact hook to say)
2. Two backup options
3. For each: the hook (word for word), talking points (3-4 bullets), and a CTA

Format your response clearly with headers and bullet points. This is not a report — it's a shot list. He should be able to read this and immediately start recording.`,
        messages: [{
          role: "user",
          content: `Here's my data. Tell me what to film today.\n\n${contextData}`,
        }],
      }),
    });

    if (!claudeRes.ok) {
      const claudeErr = await claudeRes.text();
      await failRun(`Claude API error: ${claudeRes.status} — ${claudeErr}`);
      return new Response(
        JSON.stringify({ error: "Claude API failed" }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const claudeData = await claudeRes.json();
    const recommendation = claudeData.content?.[0]?.text || "";

    // Log key parts of the recommendation
    const lines = recommendation.split("\n").filter((l: string) => l.trim());
    for (const line of lines.slice(0, 8)) {
      const trimmed = line.trim();
      if (trimmed.startsWith("#") || trimmed.startsWith("**") || trimmed.startsWith("1.")) {
        await appendLog(`[DATA] ${trimmed.replace(/[#*]/g, "").trim()}`);
      }
    }

    await appendLog(`[SUCCESS] Film Today complete. 3 video recommendations generated.`);

    await sb.from("skill_runs").update({
      status: "completed",
      logs,
      result: { recommendation, ideas_used: ideaCount },
      completed_at: new Date().toISOString(),
    }).eq("id", runId);

    return new Response(
      JSON.stringify({ ok: true, recommendation }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("run-film-today error:", message);
    await failRun(message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
