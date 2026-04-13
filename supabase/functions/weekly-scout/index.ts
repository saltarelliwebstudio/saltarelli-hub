import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyCronOrAdmin } from "../_shared/auth.ts";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

async function sendTelegram(text: string) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text,
      parse_mode: "Markdown",
    }),
  });
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

  try {
    // Fetch recent AI/tech stories from HN Algolia API
    const weekAgo = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
    const hnUrl = `https://hn.algolia.com/api/v1/search_by_date?tags=story&query=AI+tool&numericFilters=created_at_i>${weekAgo}&hitsPerPage=20`;

    const hnRes = await fetch(hnUrl);
    const hnData = await hnRes.json();

    const stories = (hnData.hits || [])
      .map((h: any) => ({
        title: h.title,
        url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
        points: h.points || 0,
      }))
      .sort((a: any, b: any) => b.points - a.points)
      .slice(0, 15);

    if (stories.length === 0) {
      await sendTelegram("🔬 *Weekly AI Scout*\n\nNo notable AI stories this week.");
      return new Response(JSON.stringify({ ok: true, stories: 0 }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const storyList = stories
      .map((s: any, i: number) => `${i + 1}. ${s.title} (${s.points} pts) — ${s.url}`)
      .join("\n");

    // Filter with Claude Haiku
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 800,
        messages: [{
          role: "user",
          content: `You are a tech scout for Saltarelli Web Studio, a solo web dev agency that builds with Next.js, Supabase, AI automation, voice agents (Retell), and Telegram bots.

From these stories, pick the TOP 5 most relevant. For each:
- *Name/title* (bold)
- One-line summary
- Why it matters for SWS
- Link

Stories:
${storyList}

Format as a clean Telegram message with Markdown. Start with "🔬 *Weekly AI Scout — ${new Date().toLocaleDateString('en-CA')}*" header.`,
        }],
      }),
    });

    const claudeData = await claudeRes.json();
    const digest = claudeData.content?.[0]?.text || "Scout digest generation failed.";

    await sendTelegram(digest);

    return new Response(
      JSON.stringify({ ok: true, stories: stories.length }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
