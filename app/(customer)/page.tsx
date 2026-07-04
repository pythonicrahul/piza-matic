import Image from "next/image";
import { getMenu } from "@/lib/data/menu";
import { getSettings } from "@/lib/data/settings";
import { MenuBrowser } from "@/components/menu-browser";
import { RecommendationBanner } from "@/components/recommendation-banner";
import { MenuReveal } from "@/components/menu-reveal";
import { HERO_PIZZA_IMAGE } from "@/lib/pizza-images";
import type { CartItemRef } from "@/lib/cart-types";

export const dynamic = "force-dynamic";

function toRef(i: { id: string; name: string; price_paise: number; is_veg?: boolean | null }): CartItemRef {
  return { id: i.id, name: i.name, price_paise: i.price_paise, is_veg: i.is_veg };
}

export default async function MenuPage() {
  let menu: { base: CartItemRef[]; pizza: CartItemRef[]; topping: CartItemRef[] } | null = null;
  let maxToppings = 5;

  try {
    const [m, settings] = await Promise.all([getMenu(), getSettings()]);
    maxToppings = settings.max_toppings;
    menu = { base: m.base.map(toRef), pizza: m.pizza.map(toRef), topping: m.topping.map(toRef) };
  } catch {
    menu = null;
  }

  return (
    <div>
      <section className="shadow-warm-lg relative -mx-4 mb-6 overflow-hidden rounded-b-[2rem] px-6 py-12 text-white sm:-mx-0 sm:rounded-[2rem] sm:py-14">
        <Image
          src={HERO_PIZZA_IMAGE}
          alt="Wood-fired pepperoni pizza"
          fill
          priority
          sizes="(max-width: 768px) 100vw, 768px"
          className="object-cover"
        />
        {/* dark gradient so the copy stays readable on top of the photo */}
        <div className="absolute inset-0 bg-gradient-to-r from-stone-950/85 via-stone-950/60 to-stone-950/20" />
        <div className="relative">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-300">New Ashok Nagar · 4 km delivery</p>
          <h1 className="mt-2 text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl">
            Build your
            <br />
            perfect slice.
          </h1>
          <p className="mt-3 max-w-sm text-sm text-white/85">
            Pick a base, pile on toppings, and we&apos;ll have it at your door — fresh, fast, and exactly how you like it.
          </p>
        </div>
      </section>

      <MenuReveal>
        <RecommendationBanner />

        {menu ? (
          <MenuBrowser menu={menu} maxToppings={maxToppings} />
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-surface p-6 text-center text-sm text-muted">
            Menu isn&apos;t loaded yet. Once the database is set up and seeded
            (<code>npm run seed:menu</code>), pizzas will appear here.
          </div>
        )}
      </MenuReveal>
    </div>
  );
}
