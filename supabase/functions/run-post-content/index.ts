import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAdmin } from "../_shared/auth.ts";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

const BUFFER_GRAPHQL_URL = "https://api.buffer.com/graphql";
const BUFFER_ORG_ID = "69bac9fdb7c96eb924dbbd80";

// Exclude Google Business Profile and Start Page from auto-publishing
const EXCLUDED_SERVICES = new Set(["googlebusiness", "startPage"]);

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

  async function bufferQuery(query: string, variables: Record<string, unknown>, token: string) {
    const res = await fetch(BUFFER_GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) throw new Error(`Buffer API error: ${res.status}`);
    const data = await res.json();
    if (data.errors) throw new Error(`Buffer GraphQL: ${JSON.stringify(data.errors)}`);
    return data.data;
  }

  try {
    const { run_id } = await req.json();
    runId = run_id;

    if (!runId) {
      return new Response(JSON.stringify({ error: "run_id is required" }), {
        status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const { data: runCheck } = await sb.from("skill_runs").select("status").eq("id", runId).single();
    if (runCheck?.status === "stopped") {
      return new Response(JSON.stringify({ ok: true, stopped: true }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const bufferToken = Deno.env.get("BUFFER_ACCESS_TOKEN");
    if (!bufferToken) {
      await failRun("BUFFER_ACCESS_TOKEN not set in Supabase Edge Function secrets.");
      return new Response(JSON.stringify({ error: "Buffer token missing" }), {
        status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

    // --- Step 1: Check publish queue for ready videos ---
    await appendLog("[INFO] Checking publish queue for ready videos...");

    const { data: queueItems } = await sb
      .from("publish_queue")
      .select("*")
      .in("status", ["detected", "published"])
      .order("created_at", { ascending: false })
      .limit(5);

    // Also check for videos that have been processed but could be re-queued
    const { data: publishedItems } = await sb
      .from("publish_queue")
      .select("gdrive_file_name,video_url,youtube_title,description_template,status,processed_at")
      .eq("status", "published")
      .order("processed_at", { ascending: false })
      .limit(5);

    await appendLog(`[DATA] ${publishedItems?.length || 0} recently published videos`);

    // --- Step 2: Get latest script for posting ---
    await appendLog("[INFO] Finding latest approved or draft script to post...");

    const { data: latestScript } = await sb
      .from("content_scripts")
      .select("*")
      .in("status", ["draft", "approved"])
      .order("created_at", { ascending: false })
      .limit(1);

    if (latestScript?.length) {
      await appendLog(`[DATA] Found script: "${latestScript[0].hook?.slice(0, 50)}..."`);
    }

    // --- Step 3: Get description template ---
    await appendLog("[INFO] Selecting description template...");

    const { data: templates } = await sb
      .from("description_templates")
      .select("*")
      .eq("active", true)
      .order("last_used_at", { ascending: true, nullsFirst: true })
      .limit(1);

    let description = templates?.[0]?.text || "Check out our latest content! #SaltarelliWebStudio";

    // AI rephrase for variety
    if (anthropicKey && templates?.[0]) {
      await appendLog("[INFO] AI-rephrasing description for variety...");
      try {
        const rephraseRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": anthropicKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 300,
            messages: [{
              role: "user",
              content: `Rephrase this social media description naturally while keeping the EXACT same CTA keyword (the word in quotes that people comment), the same core message, and ALL hashtags. Just change the wording slightly for variety. Return ONLY the rephrased text, nothing else.\n\nOriginal:\n${templates[0].text}`,
            }],
          }),
        });
        if (rephraseRes.ok) {
          const rephraseData = await rephraseRes.json();
          description = rephraseData.content?.[0]?.text?.trim() || description;
          await appendLog("[DATA] Description rephrased with AI");
        }
      } catch {
        // Fall back to original template
      }

      // Update template usage
      await sb.from("description_templates").update({
        last_used_at: new Date().toISOString(),
        use_count: (templates[0].use_count || 0) + 1,
      }).eq("id", templates[0].id);
    }

    // --- Step 4: List Buffer channels ---
    await appendLog("[INFO] Connecting to Buffer...");

    const channelsData = await bufferQuery(
      `query ListChannels($input: ChannelsInput!) {
        channels(input: $input) { id name service displayName isDisconnected }
      }`,
      { input: { organizationId: BUFFER_ORG_ID } },
      bufferToken
    );

    const channels = (channelsData.channels || []).filter(
      (ch: Record<string, unknown>) => !EXCLUDED_SERVICES.has(ch.service as string) && !ch.isDisconnected
    );

    await appendLog(`[DATA] ${channels.length} active channels: ${channels.map((c: Record<string, string>) => c.service).join(", ")}`);

    // Check if stopped
    const { data: midCheck } = await sb.from("skill_runs").select("status").eq("id", runId).single();
    if (midCheck?.status === "stopped") {
      await appendLog("[STOPPED] Run cancelled by user.");
      return new Response(JSON.stringify({ ok: true, stopped: true }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // --- Step 5: Queue text post to all channels ---
    await appendLog("[INFO] Queuing post to Buffer...");

    let successCount = 0;
    let errorCount = 0;
    const postResults: Array<Record<string, unknown>> = [];

    for (const channel of channels) {
      try {
        const input: Record<string, unknown> = {
          channelId: channel.id,
          text: description,
          mode: "addToQueue",
          schedulingType: "automatic",
        };

        // Add YouTube title if YouTube channel
        if (channel.service === "youtube" && anthropicKey) {
          const titleRes = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": anthropicKey,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model: "claude-haiku-4-5-20251001",
              max_tokens: 50,
              messages: [{
                role: "user",
                content: `Generate a YouTube Shorts title under 70 characters for this post. Direct, punchy, first-person. No quotes. Just the title.\n\n${description.slice(0, 200)}`,
              }],
            }),
          });
          if (titleRes.ok) {
            const titleData = await titleRes.json();
            const ytTitle = titleData.content?.[0]?.text?.trim()?.slice(0, 70) || "AI Automation Tips";
            input.metadata = {
              youtube: { title: ytTitle, categoryId: "22", madeForKids: false },
            };
          }
        }

        const result = await bufferQuery(
          `mutation CreatePost($input: CreatePostInput!) {
            createPost(input: $input) {
              ... on PostActionSuccess { post { id status dueAt } }
              ... on InvalidInputError { message }
              ... on LimitReachedError { message }
              ... on UnexpectedError { message }
            }
          }`,
          { input },
          bufferToken
        );

        const post = result.createPost;
        if (post.post) {
          successCount++;
          postResults.push({ channel: channel.displayName, service: channel.service, postId: post.post.id, dueAt: post.post.dueAt });
          await appendLog(`[DATA] Queued to ${channel.displayName} (${channel.service}) — due: ${post.post.dueAt || "next slot"}`);
        } else {
          errorCount++;
          await appendLog(`[WARN] ${channel.displayName}: ${post.message || "Unknown error"}`);
        }
      } catch (err: unknown) {
        errorCount++;
        const msg = err instanceof Error ? err.message : "Unknown error";
        await appendLog(`[WARN] ${channel.displayName}: ${msg}`);
      }
    }

    await appendLog(`[SUCCESS] Post Content complete. ${successCount} channels queued, ${errorCount} errors.`);

    await sb.from("skill_runs").update({
      status: "completed",
      logs,
      result: { successCount, errorCount, posts: postResults },
      completed_at: new Date().toISOString(),
    }).eq("id", runId);

    return new Response(
      JSON.stringify({ ok: true, successCount, errorCount }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("run-post-content error:", message);
    await failRun(message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
