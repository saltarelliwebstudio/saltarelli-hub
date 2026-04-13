import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyCronOrAdmin } from "../_shared/auth.ts";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

async function sendTelegram(text: string) {
  // Telegram has a 4096 char limit — split if needed
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= 4000) {
      chunks.push(remaining);
      break;
    }
    // Split at last newline before 4000
    const cutoff = remaining.lastIndexOf("\n", 4000);
    const splitAt = cutoff > 2000 ? cutoff : 4000;
    chunks.push(remaining.substring(0, splitAt));
    remaining = remaining.substring(splitAt);
  }

  for (const chunk of chunks) {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: chunk,
        parse_mode: "Markdown",
      }),
    });
  }
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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Fetch content from last 7 days
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: posts, error: fetchErr } = await supabase
      .from("content_posts")
      .select("*")
      .gte("posted_at", weekAgo)
      .order("posted_at", { ascending: false });

    if (fetchErr) throw new Error(`Fetch error: ${fetchErr.message}`);

    if (!posts || posts.length === 0) {
      await sendTelegram("*Weekly Content Report*\n\nNo content tracked this week. Start logging!");
      return new Response(
        JSON.stringify({ ok: true, posts: 0 }),
        { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Build platform summary
    const platforms: Record<string, {
      count: number; views: number; likes: number;
      comments: number; shares: number; topPost: any;
    }> = {};

    for (const post of posts) {
      const p = post.platform;
      if (!platforms[p]) {
        platforms[p] = { count: 0, views: 0, likes: 0, comments: 0, shares: 0, topPost: null };
      }
      platforms[p].count++;
      platforms[p].views += post.views || 0;
      platforms[p].likes += post.likes || 0;
      platforms[p].comments += post.comments || 0;
      platforms[p].shares += post.shares || 0;
      if (!platforms[p].topPost || (post.views || 0) > (platforms[p].topPost.views || 0)) {
        platforms[p].topPost = post;
      }
    }

    // Build data summary for Claude
    const platformSummaries = Object.entries(platforms)
      .map(([name, data]) => {
        const top = data.topPost;
        return `${name.toUpperCase()}: ${data.count} posts, ${data.views} views, ${data.likes} likes, ${data.comments} comments, ${data.shares} shares
  Top post: "${top?.title}" (${top?.views || 0} views, ${top?.likes || 0} likes)
  Format breakdown: ${posts.filter(p => p.platform === name).map(p => p.content_format).filter(Boolean).join(", ") || "N/A"}`;
      })
      .join("\n\n");

    // Total across all platforms
    const totalViews = Object.values(platforms).reduce((s, p) => s + p.views, 0);
    const totalLikes = Object.values(platforms).reduce((s, p) => s + p.likes, 0);
    const totalComments = Object.values(platforms).reduce((s, p) => s + p.comments, 0);
    const totalPosts = posts.length;

    // Get previous week for comparison
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const { data: prevPosts } = await supabase
      .from("content_posts")
      .select("platform, views, likes, comments")
      .gte("posted_at", twoWeeksAgo)
      .lt("posted_at", weekAgo);

    const prevViews = (prevPosts || []).reduce((s, p) => s + (p.views || 0), 0);
    const prevLikes = (prevPosts || []).reduce((s, p) => s + (p.likes || 0), 0);

    const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const weekEnd = new Date().toISOString().split("T")[0];

    // Ask Claude for strategy analysis
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1200,
        messages: [{
          role: "user",
          content: `You are SWS Content Analyst — Adam Saltarelli's content strategist. He runs Saltarelli Web Studio (web dev agency) and creates content about tech, AI, automation for contractors, and "The Tech Frontier" podcast.

Generate a weekly content performance report for ${weekStart} to ${weekEnd}.

THIS WEEK'S DATA:
${totalPosts} total posts | ${totalViews} views | ${totalLikes} likes | ${totalComments} comments

PREVIOUS WEEK COMPARISON:
${prevPosts?.length || 0} posts | ${prevViews} views | ${prevLikes} likes

PLATFORM BREAKDOWN:
${platformSummaries}

Format as a Telegram message with Markdown. Include:
1. *Scoreboard* — total reach, engagement, week-over-week trend arrows
2. *Platform Highlights* — 1-2 lines per active platform, call out the top performer
3. *What Worked* — identify patterns (format, topic, timing)
4. *Recommendations* — 3 specific, actionable content ideas for next week with hooks
5. *Posting Schedule* — suggested posting days/times based on what performed

Start with: "*Weekly Content Report — ${weekStart} to ${weekEnd}*"
Keep it punchy and strategic. Use emojis sparingly.`,
        }],
      }),
    });

    const claudeData = await claudeRes.json();
    const reportText = claudeData.content?.[0]?.text || "Report generation failed.";

    // Extract recommendations from the report
    const recommendations = reportText
      .split("\n")
      .filter((line: string) => line.match(/^\d+\.|^-|^•/))
      .slice(0, 5);

    // Store in content_reports
    const { error: insertErr } = await supabase.from("content_reports").insert({
      week_start: weekStart,
      week_end: weekEnd,
      report_text: reportText,
      recommendations,
      platform_breakdown: platforms,
      sent_to_telegram: true,
    });

    if (insertErr) {
      console.error("Failed to store report:", insertErr.message);
    }

    // Send to Telegram
    await sendTelegram(reportText);

    return new Response(
      JSON.stringify({ ok: true, posts: totalPosts, platforms: Object.keys(platforms) }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("weekly-content-report error:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
