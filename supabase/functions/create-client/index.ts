import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RetellAccount {
  label: string;
  retell_api_key: string;
  retell_agent_id: string;
}

interface CreateClientRequest {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  company_name?: string;
  address?: string;
  voice_enabled?: boolean;
  automations_enabled?: boolean;
  retell_accounts?: RetellAccount[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      email,
      password,
      full_name,
      phone,
      company_name,
      address,
      voice_enabled = false,
      automations_enabled = false,
      retell_accounts = [],
    }: CreateClientRequest = await req.json();

    // Validation
    if (!email || !password || !full_name) {
      return new Response(
        JSON.stringify({ error: "Email, password, and full name are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (password.length < 8) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 8 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Check if email already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const emailExists = existingUsers?.users?.some(u => u.email === email);
    
    if (emailExists) {
      return new Response(
        JSON.stringify({ error: "A user with that email already exists" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create auth user
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (authError) {
      return new Response(
        JSON.stringify({ error: authError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = authUser.user.id;

    // The trigger handle_new_user will create the profile and user_role
    // Wait a moment for the trigger to complete
    await new Promise(resolve => setTimeout(resolve, 500));

    // Update profile with additional info
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ full_name })
      .eq("id", userId);

    if (profileError) {
      console.error("Profile update error:", profileError);
    }

    // Create the pod
    const { data: pod, error: podError } = await supabaseAdmin
      .from("pods")
      .insert({
        name: full_name,
        owner_id: userId,
        company_name: company_name || null,
        contact_email: email,
        contact_phone: phone || null,
        address: address || null,
      })
      .select()
      .single();

    if (podError) {
      console.error("Pod creation error:", podError);
      // Rollback: delete the auth user
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ error: "Failed to create client workspace: " + podError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update pod settings
    const { error: settingsError } = await supabaseAdmin
      .from("pod_settings")
      .update({
        voice_enabled,
        automations_enabled,
        billing_enabled: false,
      })
      .eq("pod_id", pod.id);

    if (settingsError) {
      console.error("Settings update error:", settingsError);
    }

    // Create Retell accounts if provided
    if (retell_accounts && retell_accounts.length > 0) {
      const retellAccountsData = retell_accounts.map(acc => ({
        pod_id: pod.id,
        label: acc.label,
        retell_api_key: acc.retell_api_key,
        retell_agent_id: acc.retell_agent_id,
        is_active: true,
      }));

      const { error: retellError } = await supabaseAdmin
        .from("retell_accounts")
        .insert(retellAccountsData);

      if (retellError) {
        console.error("Retell accounts creation error:", retellError);
      }
    }

    // If voice is enabled and there are Retell accounts, trigger a sync
    if (voice_enabled && retell_accounts && retell_accounts.length > 0) {
      // Trigger sync asynchronously (don't wait for it)
      fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/sync-retell-calls`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pod_id: pod.id }),
      }).catch(err => console.error("Sync trigger error:", err));
    }

    return new Response(
      JSON.stringify({
        success: true,
        user_id: userId,
        pod_id: pod.id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Create client error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
