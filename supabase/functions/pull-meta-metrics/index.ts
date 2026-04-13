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
    const metaToken = Deno.env.get("META_PAGE_ACCESS_TOKEN");
    const igAccountId = Deno.env.get("INSTAGRAM_BUSINESS_ACCOUNT_ID");
    const fbPageId = Deno.env.get("FACEBOOK_PAGE_ID");

    if (!metaToken) {
      throw new Error("Missing META_PAGE_ACCESS_TOKEN");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    let totalUpserted = 0;

    // --- Instagram ---
    if (igAccountId) {
      const igUpserted = await pullInstagram(supabase, metaToken, igAccountId);
      totalUpserted += igUpserted;
      console.log(`Instagram: ${igUpserted} posts upserted`);
    } else {
      console.log("Skipping Instagram: no INSTAGRAM_BUSINESS_ACCOUNT_ID");
    }

    // --- Facebook ---
    if (fbPageId) {
      const fbUpserted = await pullFacebook(supabase, metaToken, fbPageId);
      totalUpserted += fbUpserted;
      console.log(`Facebook: ${fbUpserted} posts upserted`);
    } else {
      console.log("Skipping Facebook: no FACEBOOK_PAGE_ID");
    }

    // --- Check token expiry ---
    await checkTokenExpiry(metaToken);

    return new Response(
      JSON.stringify({ success: true, upserted: totalUpserted }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("pull-meta-metrics error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});

async function pullInstagram(
  supabase: any,
  token: string,
  accountId: string
): Promise<number> {
  // Fetch recent media
  const mediaRes = await fetch(
    `https://graph.facebook.com/v21.0/${accountId}/media?fields=id,caption,timestamp,media_type,permalink,media_product_type&limit=25&access_token=${token}`
  );
  const mediaData = await mediaRes.json();

  if (mediaData.error) {
    console.error("IG media fetch error:", mediaData.error.message);
    return 0;
  }

  let upserted = 0;
  for (const media of mediaData.data || []) {
    // Fetch insights for each media
    const insightsFields =
      media.media_product_type === "REELS"
        ? "plays,likes,comments,shares,saved,reach"
        : "impressions,reach,likes,comments,saved,shares";

    const insightsRes = await fetch(
      `https://graph.facebook.com/v21.0/${media.id}/insights?metric=${insightsFields}&access_token=${token}`
    );
    const insightsData = await insightsRes.json();

    const metrics: Record<string, number> = {};
    for (const insight of insightsData.data || []) {
      metrics[insight.name] = insight.values?.[0]?.value || 0;
    }

    const isReel = media.media_product_type === "REELS";
    const isCarousel = media.media_type === "CAROUSEL_ALBUM";
    const format = isReel ? "reel" : isCarousel ? "carousel" : "post";

    const { error } = await supabase.from("content_posts").upsert(
      {
        platform: "instagram",
        external_id: media.id,
        title: (media.caption || "").substring(0, 100) || "Untitled",
        content_format: format,
        posted_at: media.timestamp,
        url: media.permalink,
        views: metrics.plays || metrics.impressions || null,
        likes: metrics.likes || null,
        comments: metrics.comments || null,
        shares: metrics.shares || null,
        saves: metrics.saved || null,
        reach: metrics.reach || null,
        impressions: metrics.impressions || null,
        source: "auto_pull",
      },
      { onConflict: "platform,external_id", ignoreDuplicates: false }
    );

    if (error) {
      console.error(`Error upserting IG ${media.id}:`, error.message);
    } else {
      upserted++;
    }
  }

  return upserted;
}

async function pullFacebook(
  supabase: any,
  token: string,
  pageId: string
): Promise<number> {
  // Fetch recent page posts
  const postsRes = await fetch(
    `https://graph.facebook.com/v21.0/${pageId}/posts?fields=id,message,created_time,permalink_url,type&limit=25&access_token=${token}`
  );
  const postsData = await postsRes.json();

  if (postsData.error) {
    console.error("FB posts fetch error:", postsData.error.message);
    return 0;
  }

  let upserted = 0;
  for (const post of postsData.data || []) {
    // Fetch post insights
    const insightsRes = await fetch(
      `https://graph.facebook.com/v21.0/${post.id}/insights?metric=post_impressions,post_engaged_users,post_reactions_by_type_total,post_clicks&access_token=${token}`
    );
    const insightsData = await insightsRes.json();

    const metrics: Record<string, any> = {};
    for (const insight of insightsData.data || []) {
      metrics[insight.name] = insight.values?.[0]?.value;
    }

    const reactions = metrics.post_reactions_by_type_total || {};
    const totalReactions = Object.values(reactions).reduce(
      (sum: number, v: any) => sum + (Number(v) || 0),
      0
    );

    const format =
      post.type === "video"
        ? "reel"
        : post.type === "photo"
        ? "post"
        : post.type || "post";

    const { error } = await supabase.from("content_posts").upsert(
      {
        platform: "facebook",
        external_id: post.id,
        title: (post.message || "").substring(0, 100) || "Untitled",
        content_format: format,
        posted_at: post.created_time,
        url: post.permalink_url,
        impressions: metrics.post_impressions || null,
        reach: metrics.post_engaged_users || null,
        likes: totalReactions || null,
        clicks: metrics.post_clicks || null,
        source: "auto_pull",
      },
      { onConflict: "platform,external_id", ignoreDuplicates: false }
    );

    if (error) {
      console.error(`Error upserting FB ${post.id}:`, error.message);
    } else {
      upserted++;
    }
  }

  return upserted;
}

async function checkTokenExpiry(token: string): Promise<void> {
  try {
    const debugRes = await fetch(
      `https://graph.facebook.com/v21.0/debug_token?input_token=${token}&access_token=${token}`
    );
    const debugData = await debugRes.json();
    const expiresAt = debugData.data?.expires_at;

    if (expiresAt) {
      const daysLeft = Math.floor(
        (expiresAt * 1000 - Date.now()) / (1000 * 60 * 60 * 24)
      );
      if (daysLeft <= 7) {
        console.warn(
          `META TOKEN EXPIRING IN ${daysLeft} DAYS — remind Adam to refresh!`
        );
      } else {
        console.log(`Meta token expires in ${daysLeft} days`);
      }
    }
  } catch {
    console.log("Could not check token expiry");
  }
}
