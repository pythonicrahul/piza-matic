import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { LogoutButton } from "@/components/admin/logout-button";
import { PizzaMark } from "@/components/pizza-art";

export default async function AdminDashLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireAdmin();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-surface/90 shadow-warm-sm backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-2 font-extrabold text-brand">
              <PizzaMark size={22} />
              SliceMatic Admin
            </span>
            <nav className="flex gap-4 text-sm font-medium">
              <Link href="/admin" className="hover:text-brand">Dashboard</Link>
              <Link href="/admin/kitchen" className="hover:text-brand">Kitchen</Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-muted sm:inline">{profile.full_name ?? "Admin"}</span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
