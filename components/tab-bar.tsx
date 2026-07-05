"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// iOS-style bottom tab bar: fixed, blurred, thin top border, respects the home-
// indicator safe area. Shared by the customer and rider apps (not admin).
export function TabBar({ children }: { children: React.ReactNode }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/85 backdrop-blur-lg"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-md items-stretch justify-around">{children}</div>
    </nav>
  );
}

export function TabLink({
  href,
  label,
  icon,
  badge,
  exact,
}: {
  href: string;
  label: string;
  icon: (active: boolean) => React.ReactNode;
  badge?: number;
  exact?: boolean;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-semibold transition-colors ${
        active ? "text-brand" : "text-muted"
      }`}
    >
      <span className="relative">
        {icon(active)}
        {badge != null && badge > 0 && (
          <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[9px] font-bold text-white">
            {badge}
          </span>
        )}
      </span>
      {label}
    </Link>
  );
}

// --- icons (24px, stroke = currentColor; filled subtly when active) --- //
const stroke = (active: boolean) => (active ? 2.1 : 1.7);

export const MenuIcon = (a: boolean) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke(a)} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 6.5C4 5 5 4 6.5 4H16c2.2 0 4 1.8 4 4v10c0 1-1 2-2.5 2H6.5C5 20 4 19 4 17.5Z" />
    <path d="M8 9h6M8 13h5" />
  </svg>
);

export const CartIcon = (a: boolean) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke(a)} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 5h2l1.2 9.2A2 2 0 0 0 9.2 16h7.2a2 2 0 0 0 2-1.6L20 8H6.2" />
    <circle cx="9.5" cy="19.5" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="17" cy="19.5" r="1.3" fill="currentColor" stroke="none" />
  </svg>
);

export const OrdersIcon = (a: boolean) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke(a)} strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 3h9l4 4v13c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1V4c0-.6.4-1 1-1Z" />
    <path d="M14 3v4h4M8 12h7M8 16h5" />
  </svg>
);

export const UserIcon = (a: boolean) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke(a)} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
  </svg>
);

export const ChatIcon = (a: boolean) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke(a)} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 5.5C4 4.7 4.7 4 5.5 4h13c.8 0 1.5.7 1.5 1.5v8c0 .8-.7 1.5-1.5 1.5H9l-4 4v-4H5.5C4.7 15 4 14.3 4 13.5Z" />
    <path d="m12 7.4.85 2 2 .85-2 .85L12 13.1l-.85-2-2-.85 2-.85Z" fill="currentColor" stroke="none" />
  </svg>
);

export const ScooterIcon = (a: boolean) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke(a)} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="6" cy="18" r="2.2" />
    <circle cx="18" cy="18" r="2.2" />
    <path d="M8.2 18h7.6M13 7h3l2.5 8M13 7h-2.5M10.5 7 8 18" />
    <path d="M13 7V5h2" />
  </svg>
);
