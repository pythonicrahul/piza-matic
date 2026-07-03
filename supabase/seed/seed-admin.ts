/**
 * Create (or re-use) the admin auth user and give them the admin profile row.
 *   npm run seed:admin
 * Credentials come from ADMIN_EMAIL / ADMIN_PASSWORD in .env.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!url || !secret) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY");
  if (!email || !password) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD in .env");

  const supabase = createClient(url, secret, { auth: { persistSession: false } });

  let userId: string | undefined;
  const { data: created, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (created?.user) {
    userId = created.user.id;
  } else if (error && /already|registered|exists/i.test(error.message)) {
    const { data: list } = await supabase.auth.admin.listUsers();
    userId = list?.users.find((u) => u.email === email)?.id;
  } else if (error) {
    throw error;
  }
  if (!userId) throw new Error("Could not resolve admin user id");

  const { error: pErr } = await supabase
    .from("profiles")
    .upsert({ id: userId, role: "admin", full_name: "Admin" }, { onConflict: "id" });
  if (pErr) throw pErr;

  console.log(`Admin ready → ${email} (role=admin)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
