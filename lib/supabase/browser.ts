"use client";

// Browser Supabase client (anon key). Used for public menu reads and, for
// authenticated admin/rider pages, the logged-in session. RLS gates all access.

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
