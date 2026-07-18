import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "./supabase-server";
import { supabaseAdmin } from "./supabase";

// Self-host mode (default): the app runs on the user's own machine against their
// own Supabase — there's no one to keep out, so login is skipped and everything
// is scoped to a single auto-provisioned workspace (DEFAULT_WORKSPACE_ID, seeded
// by the worker on boot). Set AUTH_ENABLED=true to turn the Supabase login back
// on (multi-tenant / SaaS). The login page + its code path below stay intact.
const AUTH_ENABLED = process.env.AUTH_ENABLED === "true";
// Self-host runs against the user's own Supabase, so one fixed workspace is
// fine (data is isolated per-database). Defaulting it means the user only sets
// their 3 Supabase keys — nothing else to configure.
const SELF_HOST_WORKSPACE = process.env.DEFAULT_WORKSPACE_ID || "00000000-0000-4000-8000-000000000001";

function selfHostSession() {
  return { user: { id: "self-host", email: null as string | null }, workspaceId: SELF_HOST_WORKSPACE };
}

// For server components — redirects to /login if not authenticated
export const getSession = cache(async () => {
  if (!AUTH_ENABLED) return selfHostSession();

  const supabase = await createSupabaseServer();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  const { data: profile } = await supabaseAdmin()
    .from("profiles")
    .select("workspace_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  return { user, workspaceId: profile.workspace_id as string };
});

// For API routes — returns null if not authenticated (no redirect)
export async function getApiSession() {
  if (!AUTH_ENABLED) {
    return selfHostSession();
  }

  const supabase = await createSupabaseServer();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  const { data: profile } = await supabaseAdmin()
    .from("profiles")
    .select("workspace_id")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  return { user, workspaceId: profile.workspace_id as string };
}
