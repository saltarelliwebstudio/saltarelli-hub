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

    // --- Step 1: Pull social analytics from DB ---
    await appendLog("[INFO] Pulling social media analytics (last 30 days)...");

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data: posts } = await sb
      .from("content_posts")
      .select("title,topic,hook,cta,content_format,views,likes,comments,shares,saves,reach,posted_at")
      .gte("posted_at", thirtyDaysAgo)
      .order("views", { ascending: false })
      .limit(20);

    const { data: igPosts } = await sb
      .from("social_posts")
      .select("caption,media_type,like_count,comments_count,timestamp")
      .order("timestamp", { ascending: false })
      .limit(30);

    const totalPosts = (posts?.length || 0) + (igPosts?.length || 0);
    await appendLog(`[DATA] Found ${totalPosts} posts for analysis`);

    // Check if stopped
    const { data: midCheck } = await sb.from("skill_runs").select("status").eq("id", runId).single();
    if (midCheck?.status === "stopped") {
      await appendLog("[STOPPED] Run cancelled by user.");
      return new Response(JSON.stringify({ ok: true, stopped: true }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // --- Step 1.5: Pull from Notion Brain ---
    let brainEntries: Array<Record<string, unknown>> = [];
    const notionKey = Deno.env.get("NOTION_API_KEY");
    const notionBrainDb = Deno.env.get("NOTION_BRAIN_DB");

    if (notionKey && notionBrainDb) {
      await appendLog("[INFO] Pulling from your Notion Brain...");
      try {
        const notionRes = await fetch(`https://api.notion.com/v1/databases/${notionBrainDb}/query`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${notionKey}`,
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            page_size: 15,
            sorts: [{ timestamp: "last_edited_time", direction: "descending" }],
          }),
        });
        if (notionRes.ok) {
          const notionData = await notionRes.json();
          brainEntries = (notionData.results || []).map((page: any) => {
            const props = page.properties || {};
            // Extract title and any text properties
            const title = Object.values(props).find((p: any) => p.type === "title") as any;
            const titleText = title?.title?.[0]?.plain_text || "Untitled";
            return {
              title: titleText,
              last_edited: page.last_edited_time,
              url: page.url,
            };
          });
          await appendLog(`[DATA] Pulled ${brainEntries.length} entries from Notion Brain`);
        } else {
          await appendLog(`[WARN] Notion API returned ${notionRes.status} — skipping Brain entries`);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown";
        await appendLog(`[WARN] Notion Brain fetch failed: ${msg}`);
      }
    } else {
      await appendLog("[INFO] Notion Brain not configured — skipping (set NOTION_API_KEY + NOTION_BRAIN_DB)");
    }

    // --- Step 1.6: Pull latest competitor analysis ---
    const { data: latestReport } = await sb
      .from("content_reports")
      .select("report_text,recommendations")
      .order("created_at", { ascending: false })
      .limit(1);

    let competitorContext = "";
    if (latestReport?.length) {
      competitorContext = `\n\nLatest competitor analysis:\n${latestReport[0].report_text?.slice(0, 1500) || ""}`;
      await appendLog("[DATA] Loaded latest competitor analysis for context");
    }

    // --- Step 2: Generate ideas with Claude ---
    await appendLog("[INFO] Analyzing trends and generating content ideas...");

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      await failRun("ANTHROPIC_API_KEY not set in Supabase secrets.");
      return new Response(
        JSON.stringify({ error: "Anthropic key missing" }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const analyticsContext = JSON.stringify({
      contentPosts: posts?.slice(0, 10) || [],
      igPosts: igPosts?.slice(0, 15) || [],
      brainEntries: brainEntries.slice(0, 10),
    });

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: `You are Adam Saltarelli's content strategist. Adam is a 17-year-old solo founder running Saltarelli Web Studio in the Niagara region, serving trades businesses with AI automations, voice agents, and websites.

Generate 15-20 ranked content ideas. For each, return JSON with:
- hook: exact opening line (stop the scroll in <2 seconds)
- topic: 1-sentence description
- format: list | story | how-to | behind-the-scenes | client-result | hot-take
- retention_driver: curiosity | steps | story | reveal | comparison
- score: 1-10 (trending potential + authenticity + hook strength)
- source: which data source inspired this
- cta: operator-kit | leaky-bucket | none
- long_form_potential: true/false

Return ONLY a JSON array. No markdown fences.`,
        messages: [{
          role: "user",
          content: `Here's Adam's recent social media performance data:\n${analyticsContext}\n\nAlso consider trending topics in AI automation, voice agents, trades business tech, and building in public (April 2026).${competitorContext}\n\nPrioritize ideas from real experiences (Brain entries) over generic trends. Stories retain better than tips. Generate the content ideas.`,
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
    const ideasText = claudeData.content?.[0]?.text || "[]";

    let ideas: Array<Record<string, unknown>>;
    try {
      let cleaned = ideasText.trim();
      if (cleaned.startsWith("```")) {
        cleaned = cleaned.split("\n").slice(1).join("\n");
        cleaned = cleaned.replace(/```\s*$/, "");
      }
      ideas = JSON.parse(cleaned);
    } catch {
      await failRun(`Failed to parse Claude response as JSON`);
      return new Response(
        JSON.stringify({ error: "Failed to parse ideas" }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    await appendLog(`[DATA] Generated ${ideas.length} content ideas`);

    // Log top 3 ideas
    for (const idea of ideas.slice(0, 3)) {
      await appendLog(`[DATA] Score ${idea.score}/10: "${String(idea.hook).slice(0, 60)}..."`);
    }

    // --- Step 3: Store ideas in Supabase ---
    await appendLog("[INFO] Storing ideas in database...");

    const today = new Date().toISOString().split("T")[0];
    const ideaRows = ideas.map((idea: Record<string, unknown>) => ({
      hook: idea.hook || "",
      topic: idea.topic || "",
      format: idea.format || "story",
      retention_driver: idea.retention_driver || "",
      score: idea.score || 5,
      source: idea.source || "",
      cta: idea.cta || "none",
      long_form_potential: idea.long_form_potential || false,
      week_of: today,
      status: "new",
    }));

    const { error: insertErr } = await sb.from("content_ideas").insert(ideaRows);
    if (insertErr) {
      await failRun(`Database insert error: ${insertErr.message}`);
      return new Response(
        JSON.stringify({ error: "DB insert failed" }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    await appendLog(`[SUCCESS] Content intelligence complete. ${ideas.length} ideas stored for week of ${today}.`);

    await sb.from("skill_runs").update({
      status: "completed",
      logs,
      result: { ideas_count: ideas.length, top_score: Math.max(...ideas.map((i: any) => i.score || 0)) },
      completed_at: new Date().toISOString(),
    }).eq("id", runId);

    return new Response(
      JSON.stringify({ ok: true, ideas: ideas.length }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("run-content-intelligence error:", message);
    await failRun(message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
