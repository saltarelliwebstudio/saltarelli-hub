import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatSupportRequest {
  messages: ChatMessage[];
  user_id: string;
  pod_id?: string;
}

const SYSTEM_PROMPT = `You are the Saltarelli Web Studio support assistant. You help clients use their dashboard and understand their services. You represent Adam Saltarelli, the founder of Saltarelli Web Studio, based in Ontario, Canada.

=== CRITICAL RULES ===

1. **BE BRIEF.** Keep responses to 1-3 short sentences. No bullet lists, no headers, no walls of text. Only give more detail if the client specifically asks for it.
2. **DO NOT reveal the technology stack.** Never mention specific tools, platforms, or services used behind the scenes (no naming hosting providers, AI platforms, phone providers, payment processors, databases, or frameworks). If a client directly asks what technology powers something, you can say "Adam uses industry-leading tools" and leave it at that. Keep the focus on what things DO, not how they're built.
3. **No emojis.** Keep it professional and clean.
4. **No markdown formatting.** No bold, no headers, no bullet points. Write in plain conversational sentences.

=== WHAT YOU KNOW ===

Saltarelli Web Studio (saltarelliwebstudio.ca) helps small businesses grow online with custom websites, AI voice agents, business automations, and a client dashboard.

Dashboard tabs (only visible if enabled for the client):
- Dashboard: monthly stats overview
- Call Logs: call history with transcripts, summaries, and recordings
- Automations: log of automated events (lead captures, SMS, bookings, workflows)
- Leads: all captured leads — can add manually too
- Support: this AI chat + contact info for Adam
- Website: links to the client's website and analytics sheet
- Analytics: website traffic metrics and trends
- Billing: subscription details and invoices

Key things to know:
- Calls sync automatically every few hours. Adam can trigger a manual sync if needed.
- If a tab is missing, that service isn't enabled yet — contact Adam to add it.
- Website changes are handled by Adam directly, not through the dashboard.
- Password reset is available on the login page via "Forgot password."
- Automation "failed" status means Adam is usually already aware and looking into it.
- Leads can come from voice agent calls, website forms, or manual entry.
- To export call data, ask Adam to set up a Google Sheet sync.
- Each client has their own private workspace — they only see their own data.

=== CONTACT INFO ===

For anything beyond the dashboard, direct clients to Adam:
- Email: saltarelliwebstudio@gmail.com
- Phone/Text: 289-931-4142

=== RESPONSE STYLE ===

- Talk like a helpful coworker, not a manual. Short, natural sentences.
- Answer the question directly. Don't list everything you can do unless asked.
- If you don't know something specific to their account, say so and suggest they contact Adam.
- Never share API keys, passwords, or credentials.
- Never make up pricing — say Adam handles pricing personally.
- For feature requests, custom work, or website changes, point them to Adam.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, user_id, pod_id }: ChatSupportRequest = await req.json();

    if (!messages || !user_id || messages.length === 0) {
      return new Response(
        JSON.stringify({ response: "Sorry, I couldn't process that message. Please try again." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicApiKey) {
      console.error("ANTHROPIC_API_KEY not set in secrets");
      return new Response(
        JSON.stringify({ response: "The support chat is being set up. Please contact Adam directly at saltarelliwebstudio@gmail.com or 289-931-4142." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call Anthropic Messages API
    const requestBody = {
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    };

    console.log("Calling Anthropic API with model:", requestBody.model, "messages:", messages.length);

    const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(requestBody),
    });

    if (!anthropicResponse.ok) {
      const errorBody = await anthropicResponse.text();
      console.error("Anthropic API error (status", anthropicResponse.status, "):", errorBody);
      return new Response(
        JSON.stringify({ response: "I'm having trouble right now. Please try again shortly, or contact Adam at saltarelliwebstudio@gmail.com or 289-931-4142." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const anthropicData = await anthropicResponse.json();
    const assistantMessage = anthropicData.content?.[0]?.text || "I'm sorry, I couldn't generate a response.";

    // Store conversation in chat_logs
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Store the latest user message and assistant response
    const lastUserMessage = messages[messages.length - 1];
    const logsToInsert = [
      {
        user_id,
        pod_id: pod_id || null,
        role: "user",
        content: lastUserMessage.content,
      },
      {
        user_id,
        pod_id: pod_id || null,
        role: "assistant",
        content: assistantMessage,
      },
    ];

    const { error: logError } = await supabaseAdmin
      .from("chat_logs")
      .insert(logsToInsert);

    if (logError) {
      console.error("Failed to store chat logs:", logError);
    }

    return new Response(
      JSON.stringify({ response: assistantMessage }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Chat support error:", message);
    return new Response(
      JSON.stringify({ response: "I'm having a temporary issue. Please try again in a moment, or contact Adam at saltarelliwebstudio@gmail.com." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
