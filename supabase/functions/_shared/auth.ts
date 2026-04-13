import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Verify the caller is an authenticated admin user.
 * Uses the Authorization header JWT to check identity against user_roles table.
 */
export async function verifyAdmin(req: Request): Promise<{ error?: string }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return { error: "Missing authorization header" };

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { error: "Not authenticated" };

  const { data: role } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (role?.role !== "admin") return { error: "Admin access required" };
  return {};
}

/**
 * Check if the request is using a service_role JWT (i.e. from pg_cron).
 * This decodes the JWT payload without full verification — acceptable here
 * because Supabase already validates the JWT at the gateway level.
 */
export function isServiceRole(req: Request): boolean {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return false;
  try {
    const payload = JSON.parse(atob(auth.split(".")[1]));
    return payload.role === "service_role";
  } catch {
    return false;
  }
}

/**
 * Verify the caller is either a service_role (pg_cron) or an admin user.
 * Use this for cron-triggered functions that admins can also invoke manually.
 */
export async function verifyCronOrAdmin(req: Request): Promise<{ error?: string }> {
  if (isServiceRole(req)) return {};
  return verifyAdmin(req);
}
