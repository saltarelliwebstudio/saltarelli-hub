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
    const { pod_id } = await req.json();

    if (!pod_id) {
      return new Response(
        JSON.stringify({ error: "pod_id is required" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Get the pod to find the owner
    const { data: pod, error: podFetchError } = await supabaseAdmin
      .from("pods")
      .select("owner_id")
      .eq("id", pod_id)
      .single();

    if (podFetchError || !pod) {
      return new Response(
        JSON.stringify({ error: "Client not found" }),
        { status: 404, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const ownerId = pod.owner_id;

    // Delete the pod (this will cascade delete retell_accounts, call_logs, automation_logs, admin_notes, pod_settings, pod_members)
    const { error: podDeleteError } = await supabaseAdmin
      .from("pods")
      .delete()
      .eq("id", pod_id);

    if (podDeleteError) {
      console.error("Pod delete error:", podDeleteError);
      return new Response(
        JSON.stringify({ error: "Failed to delete client: " + podDeleteError.message }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Delete the auth user
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(ownerId);

    if (authDeleteError) {
      console.error("Auth user delete error:", authDeleteError);
      // Pod is already deleted, so just log this error
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Delete client error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
