import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyCronOrAdmin } from "../_shared/auth.ts";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function sendTelegram(text: string) {
  await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        parse_mode: "Markdown",
      }),
    }
  );
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
    const body = await req.json().catch(() => ({}));
    const type = body.type || "lead_followup"; // "lead_followup" or "client_checkin"

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (type === "lead_followup") {
      // Get active leads that need follow-up
      const today = new Date().toISOString().split("T")[0];

      const { data: overdue } = await sb
        .from("admin_leads")
        .select("name, business_name, status, last_contacted_date, next_followup_date")
        .in("status", ["warm", "hot", "followed_up", "replied", "demo_booked"])
        .or(`next_followup_date.lte.${today},last_contacted_date.is.null`)
        .order("next_followup_date", { ascending: true })
        .limit(20);

      const { count: activeCount } = await sb
        .from("admin_leads")
        .select("id", { count: "exact", head: true })
        .in("status", ["warm", "hot", "followed_up", "replied", "demo_booked"]);

      const leads = overdue || [];
      const lines: string[] = [];
      lines.push("📞 *Follow-Up Reminder*");
      lines.push("");
      lines.push(`You have *${activeCount || 0}* active leads total.`);

      if (leads.length > 0) {
        lines.push(`*${leads.length}* need attention right now:`);
        lines.push("");
        for (const l of leads.slice(0, 10)) {
          const name = l.business_name ? `${l.name} (${l.business_name})` : l.name;
          const status = l.status.replace(/_/g, " ");
          const lastContact = l.last_contacted_date || "never";
          lines.push(`• *${name}* — ${status}, last contact: ${lastContact}`);
        }
        if (leads.length > 10) {
          lines.push(`...and ${leads.length - 10} more`);
        }
      } else {
        lines.push("All caught up — no overdue follow-ups!");
      }

      lines.push("");
      lines.push("Open your dashboard to take action.");

      await sendTelegram(lines.join("\n"));
    } else if (type === "client_checkin") {
      // Count active clients
      const { data: clients } = await sb
        .from("pods")
        .select("name, company_name")
        .limit(20);

      const clientList = clients || [];
      const lines: string[] = [];
      lines.push("👥 *Client Check-In Reminder*");
      lines.push("");
      lines.push(`You have *${clientList.length}* active clients.`);
      lines.push("Touch base and make sure they're taken care of:");
      lines.push("");
      for (const c of clientList.slice(0, 10)) {
        lines.push(`• ${c.company_name || c.name}`);
      }
      if (clientList.length > 10) {
        lines.push(`...and ${clientList.length - 10} more`);
      }
      lines.push("");
      lines.push("Open your clients page to check in.");

      await sendTelegram(lines.join("\n"));
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("followup-reminder error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
