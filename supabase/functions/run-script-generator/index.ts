import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAdmin } from "../_shared/auth.ts";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

const ADAM_VOICE_PROMPT = `You are writing scripts AS Adam Saltarelli — not for him, AS him.

WHO ADAM IS:
- 17-year-old solo founder, Saltarelli Web Studio, Port Colborne, Ontario
- Builds AI automations, voice agents, and websites for trades businesses in Niagara
- Provincial-level wrestler, marathon runner, youth MMA coach at Genius Fitness MMA
- Heading to Brock University Goodman School of Business in fall 2026
- Influenced by Alex Hormozi and Dan Martell

HOW ADAM TALKS:
- Direct, energetic, no fluff. Short punchy sentences.
- Uses "here's the thing" and "look" as transitions
- Tells stories from his actual experience — never hypothetical
- Makes technical AI concepts simple with analogies
- Confident but not arrogant — he's 17 and owns it
- Uses repetition strategically ("I'm talking X, I'm talking Y, I'm talking Z")

WHAT ADAM HAS DONE (use these for stories):
- Built AI voice agents that replace receptionists for plumbers, electricians, HVAC companies
- Automated SMS follow-up systems that recover lost leads for trades businesses
- Created AI chatbots that book appointments 24/7
- Built dashboards and CRMs for small business clients in the Niagara region
- Runs a web studio solo at 17 while finishing high school

NEVER:
- Corporate jargon (leverage, synergy, ecosystem)
- LinkedIn-speak or generic motivational content
- "Hey guys!", "What's up everyone!", "in today's video"
- Talk about tools without showing the result

STRUCTURE (30-60s short-form):
[HOOK] 0-3s: Bold claim or surprising stat
[RETAIN] 3-45s: Deliver value via List/Steps/Story/Curiosity gap
[REWARD] 45-60s: Payoff — the result, insight, or takeaway
[CTA] Optional, natural mention of AI Operator Kit or Leaky Bucket Audit`;

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
    const body = await req.json();
    runId = body.run_id;
    const ideaId: string | null = body.idea_id || null;

    if (!runId) {
      return new Response(
        JSON.stringify({ error: "run_id is required" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

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

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      await failRun("ANTHROPIC_API_KEY not set in Supabase Edge Function secrets. Go to Supabase Dashboard → Edge Functions → Secrets.");
      return new Response(
        JSON.stringify({ error: "Anthropic key missing" }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // --- Try to find an idea ---
    let idea: Record<string, unknown> | null = null;

    if (ideaId) {
      await appendLog(`[INFO] Fetching idea ${ideaId}...`);
      const { data } = await sb.from("content_ideas").select("*").eq("id", ideaId).single();
      idea = data;
    } else {
      await appendLog("[INFO] Finding best unscripted idea...");
      const { data } = await sb
        .from("content_ideas")
        .select("*")
        .in("status", ["new", "approved"])
        .order("score", { ascending: false })
        .limit(1);
      idea = data?.[0] || null;
    }

    let userPrompt: string;

    if (idea) {
      await appendLog(`[DATA] Found idea: "${String(idea.hook).slice(0, 60)}..." (score: ${idea.score}/10)`);
      await appendLog(`[INFO] Generating short-form script from idea...`);

      userPrompt = `Write a 30-60 second video script based on this idea.

Hook: ${idea.hook}
Topic: ${idea.topic}
Format: ${idea.format || "story"}
Retention driver: ${idea.retention_driver || "story"}
CTA: ${idea.cta || "none"}

Structure with clear [HOOK], [RETAIN], and [REWARD] sections.
Include stage directions in [brackets].
Target 90-150 words. Write ONLY the script.`;
    } else {
      // No ideas exist — generate a script from scratch
      await appendLog("[INFO] No content ideas found in database — generating from scratch...");
      await appendLog("[INFO] Picking a trending topic for AI automation / trades business...");

      // Pull recent IG posts for context if available
      const { data: recentPosts } = await sb
        .from("social_posts")
        .select("caption,like_count,comments_count")
        .order("timestamp", { ascending: false })
        .limit(5);

      const { data: contentPosts } = await sb
        .from("content_posts")
        .select("title,topic,hook,views,likes")
        .order("posted_at", { ascending: false })
        .limit(5);

      let contextBlock = "";
      if (recentPosts?.length || contentPosts?.length) {
        contextBlock = `\n\nFor context, here are Adam's recent posts (use these to avoid repeating topics):\n${JSON.stringify([...(recentPosts || []), ...(contentPosts || [])].slice(0, 8))}`;
      }

      await appendLog("[INFO] Generating fresh script with Claude...");

      userPrompt = `You are generating a short-form video script for Adam Saltarelli.

Pick ONE of these proven topic categories and write a 30-60 second script:
1. Client result story — "I just automated [specific business type] and saved them [hours/money]"
2. AI tool demo — Show a specific automation (voice agent, SMS drip, chatbot) and the result
3. Behind the scenes — Building something live, showing the process
4. Hot take — Bold opinion about AI, business, or being a young entrepreneur
5. Quick tip — One actionable thing a trades business can do today to save time

Structure with clear [HOOK], [RETAIN], and [REWARD] sections.
Include stage directions in [brackets].
Target 90-150 words. Be SPECIFIC — use real-sounding numbers, business types, and results.
Write ONLY the script. No meta-commentary.${contextBlock}`;
    }

    // --- Generate with Claude ---
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
        system: ADAM_VOICE_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
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
    const scriptBody = claudeData.content?.[0]?.text || "";
    const wordCount = scriptBody.split(/\s+/).length;
    const estimatedDuration = Math.round(wordCount / 2.5);

    await appendLog(`[DATA] Script generated: ${wordCount} words, ~${estimatedDuration}s duration`);

    // Extract hook from the script (first non-bracket line after [HOOK])
    const hookMatch = scriptBody.match(/\[HOOK\][\s\S]*?\n([^\[\n].+)/);
    const extractedHook = hookMatch?.[1]?.trim() || String(idea?.hook || "Generated script");

    // --- Store script ---
    await appendLog("[INFO] Saving script to database...");

    const { error: insertErr } = await sb.from("content_scripts").insert({
      idea_id: idea?.id || null,
      type: "short-form",
      hook: extractedHook.slice(0, 200),
      script_body: scriptBody,
      word_count: wordCount,
      estimated_duration_seconds: estimatedDuration,
      cta_included: String(idea?.cta || "operator-kit"),
      status: "draft",
    });

    if (insertErr) {
      await failRun(`Database insert error: ${insertErr.message}`);
      return new Response(
        JSON.stringify({ error: "DB insert failed" }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Update idea status if we used one
    if (idea?.id) {
      await sb.from("content_ideas").update({ status: "scripted" }).eq("id", idea.id);
      await appendLog(`[INFO] Marked idea as "scripted"`);
    }

    // Log a preview of the script
    const preview = scriptBody.split("\n").filter((l: string) => l.trim()).slice(0, 3).join(" | ");
    await appendLog(`[DATA] Preview: ${preview.slice(0, 120)}...`);

    await appendLog(`[SUCCESS] Short-form script generated and saved. ${wordCount} words, ~${estimatedDuration}s.`);

    await sb.from("skill_runs").update({
      status: "completed",
      logs,
      result: { word_count: wordCount, duration_seconds: estimatedDuration, hook: extractedHook },
      completed_at: new Date().toISOString(),
    }).eq("id", runId);

    return new Response(
      JSON.stringify({ ok: true, word_count: wordCount, script: scriptBody }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("run-script-generator error:", message);
    await failRun(message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
