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

    // Check if run was already stopped
    const { data: runCheck } = await sb
      .from("skill_runs")
      .select("status")
      .eq("id", runId)
      .single();

    if (runCheck?.status === "stopped") {
      return new Response(
        JSON.stringify({ ok: true, stopped: true }),
        { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // --- Step 1: Fetch from Instagram ---
    await appendLog("[INFO] Connecting to Instagram Graph API...");

    const igToken = Deno.env.get("IG_ACCESS_TOKEN");
    const igUserId = Deno.env.get("IG_USER_ID");

    if (!igToken || !igUserId) {
      await failRun("Instagram API credentials not configured. Set IG_ACCESS_TOKEN and IG_USER_ID in Supabase secrets.");
      return new Response(
        JSON.stringify({ error: "IG credentials missing" }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    await appendLog("[INFO] Fetching recent posts (last 50)...");

    const igUrl = `https://graph.instagram.com/v21.0/${igUserId}/media?fields=id,caption,media_type,timestamp,like_count,comments_count,permalink,thumbnail_url&limit=50&access_token=${igToken}`;
    const igRes = await fetch(igUrl);

    if (!igRes.ok) {
      const igErr = await igRes.text();
      await failRun(`Instagram API error: ${igRes.status} — ${igErr}`);
      return new Response(
        JSON.stringify({ error: "Instagram API failed" }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const igData = await igRes.json();
    const posts = igData.data || [];

    const reelCount = posts.filter((p: any) => p.media_type === "VIDEO").length;
    const imageCount = posts.filter((p: any) => p.media_type === "IMAGE").length;
    const carouselCount = posts.filter((p: any) => p.media_type === "CAROUSEL_ALBUM").length;

    await appendLog(`[DATA] Retrieved ${posts.length} posts (${imageCount} images, ${reelCount} reels, ${carouselCount} carousels)`);

    // Check if stopped mid-run
    const { data: midCheck } = await sb.from("skill_runs").select("status").eq("id", runId).single();
    if (midCheck?.status === "stopped") {
      await appendLog("[STOPPED] Run cancelled by user.");
      return new Response(JSON.stringify({ ok: true, stopped: true }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // --- Step 2: Store posts in social_posts ---
    await appendLog("[INFO] Storing posts in database...");

    for (const post of posts) {
      await sb.from("social_posts").upsert({
        ig_media_id: post.id,
        caption: post.caption || null,
        media_type: post.media_type,
        timestamp: post.timestamp,
        like_count: post.like_count || 0,
        comments_count: post.comments_count || 0,
        permalink: post.permalink || null,
        thumbnail_url: post.thumbnail_url || null,
        fetched_at: new Date().toISOString(),
      }, { onConflict: "ig_media_id" });
    }

    await appendLog(`[DATA] Upserted ${posts.length} posts into database`);

    // --- Step 3: Analyze with Claude ---
    await appendLog("[INFO] Analyzing performance with AI...");

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      await failRun("ANTHROPIC_API_KEY not set in Supabase secrets.");
      return new Response(
        JSON.stringify({ error: "Anthropic key missing" }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Prepare post data for analysis (strip unnecessary fields, keep it concise)
    const postsForAnalysis = posts.map((p: any) => ({
      id: p.id,
      caption: (p.caption || "").slice(0, 200),
      type: p.media_type,
      likes: p.like_count || 0,
      comments: p.comments_count || 0,
      timestamp: p.timestamp,
    }));

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1500,
        messages: [{
          role: "user",
          content: `Analyze this Instagram account's recent performance. Return JSON only (no markdown fences).

Posts data:
${JSON.stringify(postsForAnalysis)}

Return this exact JSON structure:
{
  "topPosts": [{ "id": "...", "caption_preview": "...", "likes": 0, "comments": 0, "why": "..." }],
  "hashtagAnalysis": { "#tag": { "count": 0, "avg_engagement": 0 } },
  "bestPostingTimes": [{ "day": "Monday", "hour": 12, "avg_engagement": 0 }],
  "contentTypeBreakdown": { "IMAGE": { "count": 0, "avg_likes": 0 }, "VIDEO": { "count": 0, "avg_likes": 0 } },
  "insights": ["insight 1", "insight 2", "insight 3"],
  "summary": "One paragraph overview of account performance and recommendations."
}

Include the top 5 posts, top 5 hashtags, top 3 posting times, and 3-5 actionable insights.`,
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
    const analysisText = claudeData.content?.[0]?.text || "";

    let analysis: Record<string, unknown>;
    try {
      analysis = JSON.parse(analysisText);
    } catch {
      analysis = { raw: analysisText };
    }

    // Log key insights
    if (analysis.insights && Array.isArray(analysis.insights)) {
      for (const insight of analysis.insights.slice(0, 3)) {
        await appendLog(`[DATA] ${insight}`);
      }
    }

    if (analysis.summary) {
      await appendLog(`[INFO] ${String(analysis.summary).slice(0, 150)}...`);
    }

    // --- Step 4: Complete ---
    await appendLog("[SUCCESS] IG Poll complete. Analysis stored.");

    await sb.from("skill_runs").update({
      status: "completed",
      logs,
      result: analysis,
      completed_at: new Date().toISOString(),
    }).eq("id", runId);

    return new Response(
      JSON.stringify({ ok: true, posts: posts.length }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("run-ig-poll error:", message);
    await failRun(message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
