import "server-only";

// Order-history "signals" that ground the chat assistant's small talk — so when
// it says "our top pick is X, folks love it with Y" it's telling the truth.
// Reuses the same ranking we built for the cart upsell:
//   • pizza popularity  = how often each pizza is ordered
//   • topping affinity  = cart_topping_suggestions RPC (co-occurrence per pizza)
// Falls back to menu order when there's no history yet, so it always returns.

import { createAdminClient } from "@/lib/supabase/admin";
import { getMenu } from "@/lib/data/menu";

export interface TopPick {
  pizza: string;
  toppings: string[]; // most-added toppings for this pizza (0–2)
}

export async function getTopPicks(limit = 3): Promise<TopPick[]> {
  const supabase = createAdminClient();
  const menu = await getMenu();
  if (menu.pizza.length === 0) return [];

  // Popularity: count order lines per pizza (small table; count in-memory).
  const counts = new Map<string, number>();
  try {
    const { data } = await supabase.from("order_items").select("pizza_id");
    for (const row of (data ?? []) as Array<{ pizza_id: string }>) {
      counts.set(row.pizza_id, (counts.get(row.pizza_id) ?? 0) + 1);
    }
  } catch {
    /* no history — fall through to menu order */
  }

  const ranked = menu.pizza
    .map((p) => ({ p, n: counts.get(p.id) ?? 0 }))
    .sort((a, b) => b.n - a.n || a.p.sort_order - b.p.sort_order)
    .slice(0, limit);

  const picks: TopPick[] = [];
  for (const { p } of ranked) {
    let toppings: string[] = [];
    try {
      const { data } = await supabase.rpc("cart_topping_suggestions", {
        p_pizza_id: p.id,
        p_exclude: [],
        p_limit: 2,
      });
      toppings = ((data ?? []) as Array<{ name: string }>).map((t) => t.name);
    } catch {
      /* leave toppings empty */
    }
    picks.push({ pizza: p.name, toppings });
  }
  return picks;
}
