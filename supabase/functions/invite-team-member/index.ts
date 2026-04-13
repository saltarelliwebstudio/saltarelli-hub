import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAdmin } from "../_shared/auth.ts";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

interface InviteRequest {
  pod_id: string;
  email: string;
  full_name?: string;
}

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
    const { pod_id, email, full_name }: InviteRequest = await req.json();

    if (!pod_id || !email) {
      return new Response(
        JSON.stringify({ error: "pod_id and email are required" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify the requesting user is an admin or the pod owner
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Not authenticated" }),
        { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: caller } } = await supabaseUser.auth.getUser();
    if (!caller) {
      return new Response(
        JSON.stringify({ error: "Not authenticated" }),
        { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Check caller is admin or pod owner
    const { data: callerRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .single();

    const { data: pod } = await supabaseAdmin
      .from("pods")
      .select("owner_id")
      .eq("id", pod_id)
      .single();

    if (callerRole?.role !== "admin" && pod?.owner_id !== caller.id) {
      return new Response(
        JSON.stringify({ error: "Not authorized" }),
        { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Check if user with this email already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;

      // Check if already a member of this pod
      const { data: existingMember } = await supabaseAdmin
        .from("pod_members")
        .select("id")
        .eq("pod_id", pod_id)
        .eq("user_id", userId)
        .maybeSingle();

      if (existingMember) {
        return new Response(
          JSON.stringify({ error: "This user is already a member of this workspace" }),
          { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }
    } else {
      // Create a new auth user with a random password (they'll use magic link to sign in)
      const tempPassword = crypto.randomUUID();
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: full_name || email.split("@")[0] },
      });

      if (createError) {
        return new Response(
          JSON.stringify({ error: createError.message }),
          { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }

      userId = newUser.user.id;

      // Wait for trigger to create profile
      await new Promise(resolve => setTimeout(resolve, 500));

      // Update the profile name if provided
      if (full_name) {
        await supabaseAdmin
          .from("profiles")
          .update({ full_name })
          .eq("id", userId);
      }

      // Set role to member
      await supabaseAdmin
        .from("user_roles")
        .update({ role: "member" })
        .eq("user_id", userId);
    }

    // Add to pod_members
    const { error: memberError } = await supabaseAdmin
      .from("pod_members")
      .insert({
        pod_id,
        user_id: userId,
        role: "member",
        accepted_at: existingUser ? new Date().toISOString() : null,
      });

    if (memberError) {
      return new Response(
        JSON.stringify({ error: memberError.message }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Send a magic link so the new member can sign in
    if (!existingUser) {
      await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email,
      });
    }

    return new Response(
      JSON.stringify({ success: true, user_id: userId }),
      { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Invite team member error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
