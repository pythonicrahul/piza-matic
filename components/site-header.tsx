"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCart } from "./cart-provider";

interface Session {
  phone: string;
  name: string | null;
}

export function SiteHeader() {
  const { count } = useCart();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setSession(d.session))
      .catch(() => {});
  }, []);

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl">🍕</span>
          <span className="text-lg font-extrabold tracking-tight text-brand">SliceMatic</span>
        </Link>

        <div className="flex items-center gap-3 text-sm">
          <Link
            href="/cart"
            className="relative rounded-full bg-brand px-4 py-2 font-semibold text-white hover:bg-brand-dark"
          >
            Cart
            {count > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-stone-900 px-1 text-xs font-bold text-white">
                {count}
              </span>
            )}
          </Link>
          {session ? (
            <span className="hidden text-muted sm:inline">
              {session.name || session.phone}
            </span>
          ) : (
            <Link href="/login" className="font-semibold text-brand hover:underline">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
