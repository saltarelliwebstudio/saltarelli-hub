import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyCronOrAdmin } from "../_shared/auth.ts";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const VALID_STATUSES = [
  "cold", "warm", "hot", "followed_up", "replied",
  "demo_booked", "closed", "client", "do_not_contact",
];

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

  const cors = getCorsHeaders(req);

  try {
    const body = await req.json();
    const { action } = body;

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ── Action: update_lead_status ──
    if (action === "update_lead_status") {
      const { lead_id, status } = body;
      if (!lead_id || !status) {
        return errResponse(cors, 400, "lead_id and status required");
      }
      if (!VALID_STATUSES.includes(status)) {
        return errResponse(cors, 400, `Invalid status. Valid: ${VALID_STATUSES.join(", ")}`);
      }

      const updates: Record<string, any> = { status };
      if (status === "client" || status === "closed") {
        updates.closed_at = new Date().toISOString();
      }

      const { data, error } = await sb
        .from("admin_leads")
        .update(updates)
        .eq("id", lead_id)
        .select("id, name, status")
        .single();

      if (error) throw error;
      return okResponse(cors, { message: `Updated ${data.name} to ${data.status}`, lead: data });
    }

    // ── Action: set_followup_date ──
    if (action === "set_followup_date") {
      const { lead_id, date } = body;
      if (!lead_id || !date) {
        return errResponse(cors, 400, "lead_id and date (YYYY-MM-DD) required");
      }

      const { data, error } = await sb
        .from("admin_leads")
        .update({ next_followup_date: date })
        .eq("id", lead_id)
        .select("id, name, next_followup_date")
        .single();

      if (error) throw error;
      return okResponse(cors, { message: `Set follow-up for ${data.name} to ${data.next_followup_date}`, lead: data });
    }

    // ── Action: log_contact ──
    if (action === "log_contact") {
      const { lead_id } = body;
      if (!lead_id) {
        return errResponse(cors, 400, "lead_id required");
      }

      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await sb
        .from("admin_leads")
        .update({ last_contacted_date: today })
        .eq("id", lead_id)
        .select("id, name, last_contacted_date")
        .single();

      if (error) throw error;
      return okResponse(cors, { message: `Logged contact with ${data.name}`, lead: data });
    }

    // ── Action: log_client_contact ──
    if (action === "log_client_contact") {
      const { client_name } = body;
      if (!client_name) {
        return errResponse(cors, 400, "client_name required");
      }

      const search = client_name.trim();
      const { data: matches, error: findErr } = await sb
        .from("pods")
        .select("id, name, company_name")
        .or(`name.ilike.%${search}%,company_name.ilike.%${search}%`)
        .limit(5);

      if (findErr) throw findErr;
      if (!matches || matches.length === 0) {
        return errResponse(cors, 404, `No client found matching "${search}"`);
      }

      const client = matches[0];
      const now = new Date().toISOString();
      const { error: updateErr } = await sb
        .from("pods")
        .update({ last_contacted_at: now })
        .eq("id", client.id);

      if (updateErr) throw updateErr;
      return okResponse(cors, {
        message: `Logged contact with ${client.company_name || client.name}`,
        client: { id: client.id, name: client.company_name || client.name, last_contacted_at: now },
      });
    }

    // ── Action: set_demo_attended ──
    if (action === "set_demo_attended") {
      const { lead_id, attended } = body;
      if (!lead_id || typeof attended !== "boolean") {
        return errResponse(cors, 400, "lead_id and attended (boolean) required");
      }

      const { data, error } = await sb
        .from("admin_leads")
        .update({ demo_attended: attended })
        .eq("id", lead_id)
        .select("id, name, demo_attended")
        .single();

      if (error) throw error;
      return okResponse(cors, {
        message: `Marked ${data.name} as ${attended ? "showed" : "no-show"}`,
        lead: data,
      });
    }

    // ── Action: find_lead ──
    if (action === "find_lead") {
      const { name } = body;
      if (!name) return errResponse(cors, 400, "name required");

      const { data, error } = await sb
        .from("admin_leads")
        .select("id, name, business_name, status, last_contacted_date, next_followup_date, drip_step, notes")
        .or(`name.ilike.%${name.trim()}%,business_name.ilike.%${name.trim()}%`)
        .limit(5);

      if (error) throw error;
      return okResponse(cors, { matches: data || [] });
    }

    return errResponse(cors, 400, `Unknown action: ${action}. Valid: update_lead_status, set_followup_date, log_contact, log_client_contact, set_demo_attended, find_lead`);
  } catch (err) {
    console.error("sentinel-action error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

function okResponse(cors: Record<string, string>, data: any) {
  return new Response(JSON.stringify({ ok: true, ...data }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function errResponse(cors: Record<string, string>, status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
