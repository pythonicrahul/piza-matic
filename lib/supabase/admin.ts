import "server-only";

// Service-role Supabase client. BYPASSES RLS and has full privileges — use ONLY
// in trusted server code (route handlers / server actions) for the customer
// order path and other privileged writes. NEVER import this into a client
// component or expose the key to the browser.

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
