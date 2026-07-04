"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await createClient().auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }
  return (
    <button onClick={logout} className="rounded-lg px-2 py-1 text-sm text-muted transition-colors hover:bg-background hover:text-foreground">
      Sign out
    </button>
  );
}
