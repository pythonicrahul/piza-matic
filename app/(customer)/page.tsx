import { getMenu } from "@/lib/data/menu";
import { getSettings } from "@/lib/data/settings";
import { MenuBrowser } from "@/components/menu-browser";
import { RecommendationBanner } from "@/components/recommendation-banner";
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
      <section className="mb-5">
        <h1 className="text-2xl font-extrabold tracking-tight">Build your pizza 🍕</h1>
        <p className="text-sm text-muted">Fresh from New Ashok Nagar — delivered within 4 km.</p>
      </section>

      <RecommendationBanner />

      {menu ? (
        <MenuBrowser menu={menu} maxToppings={maxToppings} />
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-6 text-center text-sm text-muted">
          Menu isn&apos;t loaded yet. Once the database is set up and seeded
          (<code>npm run seed:menu</code>), pizzas will appear here.
        </div>
      )}
    </div>
  );
}
