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
      return new Response(JSON.stringify({ error: "Anthropic key missing" }), {
        status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // --- Step 1: Pull Adam's recent content for comparison baseline ---
    await appendLog("[INFO] Loading your recent content performance as baseline...");

    const { data: myPosts } = await sb
      .from("social_posts")
      .select("caption,media_type,like_count,comments_count")
      .order("timestamp", { ascending: false })
      .limit(15);

    const { data: contentPosts } = await sb
      .from("content_posts")
      .select("title,topic,hook,content_format,views,likes,comments,shares")
      .order("posted_at", { ascending: false })
      .limit(10);

    await appendLog(`[DATA] Loaded ${(myPosts?.length || 0) + (contentPosts?.length || 0)} of your recent posts`);

    // Check if stopped
    const { data: midCheck } = await sb.from("skill_runs").select("status").eq("id", runId).single();
    if (midCheck?.status === "stopped") {
      await appendLog("[STOPPED] Run cancelled by user.");
      return new Response(JSON.stringify({ ok: true, stopped: true }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // --- Step 2: Scan niche with Claude ---
    await appendLog("[INFO] Scanning AI automation + trades business niche...");
    await appendLog("[INFO] Analyzing trending hooks, formats, and topics...");

    const myContentContext = JSON.stringify({
      igPosts: myPosts?.slice(0, 10) || [],
      contentPosts: contentPosts?.slice(0, 5) || [],
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
        max_tokens: 3000,
        system: `You are a social media competitor analyst for Adam Saltarelli, a 17-year-old running Saltarelli Web Studio in Niagara, Ontario. He builds AI automations, voice agents, and websites for trades businesses.

Your job: Analyze what's working RIGHT NOW in his niche and adjacent niches on short-form video platforms. Think like a content strategist who obsessively tracks competitors.

NICHES TO ANALYZE:
1. AI automation for small/trades businesses (his primary niche)
2. Young entrepreneurs / build-in-public creators
3. AI tools and SaaS creators
4. Hormozi-style value content
5. Local business marketing

COMPETITORS/CREATORS TO REFERENCE (these are real accounts making similar content):
- @jaaborw (AI automation for businesses)
- @aidanstruby (young entrepreneur, AI agency)
- @alexhormozi (value-first content structure)
- @danmartell (SaaS/agency growth)
- @nickhuber (blue collar business + tech)
- @codyaskins (young entrepreneur)
- @leviallen_ (AI automation agency)

Analyze current trends and return a structured JSON report with:
{
  "trending_hooks": [{"hook": "...", "why_it_works": "...", "creator": "..."}],
  "trending_formats": [{"format": "...", "description": "...", "engagement_level": "high|medium"}],
  "content_gaps": ["topics Adam's competitors cover that he doesn't"],
  "viral_patterns": ["patterns that are getting outsized engagement right now"],
  "recommended_angles": [{"angle": "...", "hook_example": "...", "why": "..."}],
  "summary": "2-3 sentence overview of what's working in the niche right now"
}

Be specific. Reference real trends, not generic advice. Think April 2026.
Return ONLY JSON, no markdown fences.`,
        messages: [{
          role: "user",
          content: `Here's Adam's recent content for comparison. Tell me what competitors are doing that he's not, and what's trending in his niche right now.\n\n${myContentContext}`,
        }],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.text();
      await failRun(`Claude API error: ${claudeRes.status} — ${err}`);
      return new Response(JSON.stringify({ error: "Claude API failed" }), {
        status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const claudeData = await claudeRes.json();
    const analysisText = claudeData.content?.[0]?.text || "";

    let analysis: Record<string, unknown>;
    try {
      let cleaned = analysisText.trim();
      if (cleaned.startsWith("```")) {
        cleaned = cleaned.split("\n").slice(1).join("\n").replace(/```\s*$/, "");
      }
      analysis = JSON.parse(cleaned);
    } catch {
      analysis = { raw: analysisText };
    }

    // Log key findings
    if (Array.isArray(analysis.trending_hooks)) {
      await appendLog(`[DATA] Found ${(analysis.trending_hooks as unknown[]).length} trending hooks`);
      for (const h of (analysis.trending_hooks as Array<Record<string, string>>).slice(0, 3)) {
        await appendLog(`[DATA] Hook: "${h.hook}" — ${h.why_it_works}`);
      }
    }

    if (Array.isArray(analysis.content_gaps)) {
      await appendLog(`[DATA] ${(analysis.content_gaps as unknown[]).length} content gaps identified`);
      for (const gap of (analysis.content_gaps as string[]).slice(0, 3)) {
        await appendLog(`[DATA] Gap: ${gap}`);
      }
    }

    if (Array.isArray(analysis.viral_patterns)) {
      for (const pattern of (analysis.viral_patterns as string[]).slice(0, 2)) {
        await appendLog(`[DATA] Viral pattern: ${pattern}`);
      }
    }

    if (analysis.summary) {
      await appendLog(`[INFO] ${String(analysis.summary).slice(0, 200)}`);
    }

    // Store as a content report
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    await sb.from("content_reports").insert({
      week_start: weekStart.toISOString().split("T")[0],
      week_end: weekEnd.toISOString().split("T")[0],
      report_text: typeof analysis === "object" ? JSON.stringify(analysis, null, 2) : analysisText,
      recommendations: Array.isArray(analysis.recommended_angles)
        ? (analysis.recommended_angles as Array<Record<string, string>>).map(a => a.angle)
        : [],
      platform_breakdown: analysis as Record<string, unknown>,
    });

    await appendLog("[SUCCESS] Competitor analysis complete. Report stored.");

    await sb.from("skill_runs").update({
      status: "completed",
      logs,
      result: analysis,
      completed_at: new Date().toISOString(),
    }).eq("id", runId);

    return new Response(
      JSON.stringify({ ok: true, analysis }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("run-competitor-analysis error:", message);
    await failRun(message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
