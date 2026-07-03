import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/session";
import { getCustomerHistory } from "@/lib/data/customers";
import { getMenu } from "@/lib/data/menu";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRecommendation, type HistoryEntry, type Recommendation } from "@/lib/ai/recommend";

// Personalized suggestion shown above the menu. Falls back to a deterministic
// "house favourite" when there's no history or the LLM is unavailable, so the
// banner always has something to show.
export async function GET() {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ rec: null });

  let menu;
  try {
    menu = await getMenu();
  } catch {
    return NextResponse.json({ rec: null });
  }

  const fallback = (): { rec: Recommendation; source: "popular" } => ({
    rec: {
      pizza: menu!.pizza[0]?.name ?? "Margherita",
      base: menu!.base[0]?.name ?? "Thin Crust",
      topping: null,
      reason: "A house favourite to get you started.",
    },
    source: "popular",
  });

  // Flatten order history into prompt entries.
  const rows = (await getCustomerHistory(session.customerId)) as unknown as Array<{
    order_items: Array<{
      pizza: { name: string } | null;
      base: { name: string } | null;
      order_item_toppings: Array<{ topping: { name: string } | null }>;
    }>;
  }>;

  const history: HistoryEntry[] = [];
  for (const order of rows) {
    for (const item of order.order_items ?? []) {
      if (!item.pizza || !item.base) continue;
      history.push({
        pizza: item.pizza.name,
        base: item.base.name,
        toppings: (item.order_item_toppings ?? []).map((t) => t.topping?.name).filter(Boolean) as string[],
      });
    }
  }

  if (history.length === 0) return NextResponse.json(fallback());

  const menuNames = {
    bases: menu.base.map((b) => b.name),
    pizzas: menu.pizza.map((p) => p.name),
    toppings: menu.topping.map((t) => t.name),
  };

  const result = await getRecommendation({ history: history.slice(0, 10), menu: menuNames });
  if (!result) return NextResponse.json(fallback());

  // Cache for auditability (README/demo).
  try {
    await createAdminClient()
      .from("ai_recommendations")
      .insert({
        customer_id: session.customerId,
        model: result.model,
        prompt: result.prompt,
        response: result.rec,
      });
  } catch {
    /* non-fatal */
  }

  return NextResponse.json({ rec: result.rec, source: "ai" });
}
