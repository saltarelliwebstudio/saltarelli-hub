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
    const ytApiKey = Deno.env.get("YOUTUBE_API_KEY");
    const channelId = Deno.env.get("YOUTUBE_CHANNEL_ID");
    if (!ytApiKey || !channelId) {
      throw new Error("Missing YOUTUBE_API_KEY or YOUTUBE_CHANNEL_ID");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Fetch recent uploads playlist ID
    const channelRes = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=contentDetails,statistics&id=${channelId}&key=${ytApiKey}`
    );
    const channelData = await channelRes.json();
    if (!channelData.items?.length) {
      throw new Error("Channel not found");
    }

    const uploadsPlaylistId =
      channelData.items[0].contentDetails.relatedPlaylists.uploads;

    // Fetch last 20 videos from uploads playlist
    const playlistRes = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=20&key=${ytApiKey}`
    );
    const playlistData = await playlistRes.json();
    const videoIds = (playlistData.items || [])
      .map((item: any) => item.snippet.resourceId.videoId)
      .join(",");

    if (!videoIds) {
      return new Response(
        JSON.stringify({ message: "No videos found" }),
        { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Fetch video statistics
    const videosRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds}&key=${ytApiKey}`
    );
    const videosData = await videosRes.json();

    let upserted = 0;
    for (const video of videosData.items || []) {
      const stats = video.statistics;
      const snippet = video.snippet;

      // Parse duration to determine format (short = < 60s)
      const duration = video.contentDetails.duration; // PT1M30S format
      const isShort = parseDurationSeconds(duration) <= 60;

      // Check if already exists
      const { data: existing } = await supabase
        .from("content_posts")
        .select("id")
        .eq("platform", "youtube")
        .eq("external_id", video.id)
        .maybeSingle();

      const row = {
        platform: "youtube",
        external_id: video.id,
        title: snippet.title,
        content_format: isShort ? "short" : "long_form",
        posted_at: snippet.publishedAt,
        url: `https://youtube.com/watch?v=${video.id}`,
        views: parseInt(stats.viewCount || "0"),
        likes: parseInt(stats.likeCount || "0"),
        comments: parseInt(stats.commentCount || "0"),
        source: "auto_pull",
      };

      const { error } = existing
        ? await supabase.from("content_posts").update(row).eq("id", existing.id)
        : await supabase.from("content_posts").insert(row);

      if (error) {
        console.error(`Error upserting video ${video.id}:`, error.message);
      } else {
        upserted++;
      }
    }

    console.log(`YouTube pull complete: ${upserted} videos upserted`);
    return new Response(
      JSON.stringify({ success: true, upserted }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("pull-youtube-metrics error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});

function parseDurationSeconds(iso8601: string): number {
  const match = iso8601.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || "0");
  const minutes = parseInt(match[2] || "0");
  const seconds = parseInt(match[3] || "0");
  return hours * 3600 + minutes * 60 + seconds;
}
