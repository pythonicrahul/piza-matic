import { CartProvider } from "@/components/cart-provider";
import { SiteHeader } from "@/components/site-header";
import { CartBar } from "@/components/cart-bar";

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5 pb-24">{children}</main>
      <footer className="border-t border-border py-6 text-center text-xs text-muted">
        SliceMatic · New Ashok Nagar, Delhi · Delivering within 4 km
      </footer>
      <CartBar />
    </CartProvider>
  );
}
