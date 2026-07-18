import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Lazy singletons — created on first use, not at import time.
// This prevents "supabaseKey is required" crashes during build.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any, "public", any>;

let _supabase: AnySupabase | null = null;
let _supabaseAdmin: AnySupabase | null = null;

// Client public (côté browser, RLS appliqué)
export function supabase(): AnySupabase {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return _supabase;
}

// Client admin (côté serveur uniquement — API routes)
export function supabaseAdmin(): AnySupabase {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
  }
  return _supabaseAdmin;
}
