/**
 * Seed realistic historical orders so the analytics dashboard and the cart
 * upsell engine have signal. Each pizza is given a couple of "signature"
 * toppings that get chosen more often, creating measurable affinity.
 *
 *   npm run seed:orders
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { computeBill } from "../../lib/pricing";
import { DEFAULT_PRICING } from "../../lib/constants";
import type { CartLine, MenuItemRef } from "../../lib/types";

const N_ORDERS = 160;
const DAYS = 30;

// Realistic demand shape so the forecast model has a pattern to learn:
// lunch (12–14) + dinner (19–22) peaks, quiet mornings; weekends busier.
const HOUR_W = [0,0,0,0,0,0,1,2,3,3,3,4, 8,9,6,3,3,4,7,11,12,10,6,3]; // index = IST hour
const DOW_W = { 0: 1.3, 1: 0.8, 2: 0.8, 3: 0.9, 4: 1.0, 5: 1.4, 6: 1.6 } as Record<number, number>;

function weightedIndex(weights: number[]): number {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return weights.length - 1;
}

/** Pick an IST datetime in the last DAYS days, biased to peaks + weekends. */
function sampleWhen(): Date {
  for (let attempt = 0; attempt < 20; attempt++) {
    const dayOffset = randInt(0, DAYS - 1);
    const d = new Date(Date.now() - dayOffset * 86400000);
    const istDow = new Date(d.getTime() + 5.5 * 3600000).getUTCDay();
    if (Math.random() < DOW_W[istDow] / 1.6) {
      const hour = weightedIndex(HOUR_W);
      // build the instant that is `hour:min` IST on that calendar day
      const istDateStr = new Date(d.getTime() + 5.5 * 3600000).toISOString().slice(0, 10);
      return new Date(`${istDateStr}T${String(hour).padStart(2, "0")}:${String(randInt(0, 59)).padStart(2, "0")}:00+05:30`);
    }
  }
  return new Date(Date.now() - randInt(0, DAYS - 1) * 86400000);
}

const CUSTOMERS = [
  { phone: "9811111111", name: "Aarav" },
  { phone: "9822222222", name: "Diya" },
  { phone: "9833333333", name: "Kabir" },
  { phone: "9844444444", name: "Ananya" },
  { phone: "9855555555", name: "Vivaan" },
  { phone: "9866666666", name: "Isha" },
];

const rand = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
const randInt = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) throw new Error("Missing Supabase env");
  const s = createClient(url, secret, { auth: { persistSession: false } });

  const { data: menu } = await s.from("menu_items").select("id, category, name, price_paise, is_veg");
  if (!menu) throw new Error("No menu — run seed:menu first");
  const bases = menu.filter((m) => m.category === "base") as MenuItemRef[];
  const pizzas = menu.filter((m) => m.category === "pizza") as MenuItemRef[];
  const toppings = menu.filter((m) => m.category === "topping") as MenuItemRef[];

  // Deterministic "signature" toppings per pizza → creates affinity signal.
  const signature = new Map<string, MenuItemRef[]>();
  pizzas.forEach((p, i) => {
    signature.set(p.id, [toppings[i % toppings.length], toppings[(i + 3) % toppings.length]]);
  });

  // Idempotent: clear previously-seeded historical orders (cascades to items).
  await s.from("orders").delete().like("order_code", "PMH-%");

  // Ensure customers exist.
  const custIds = new Map<string, string>();
  for (const c of CUSTOMERS) {
    const { data: ex } = await s.from("customers").select("id").eq("phone", c.phone).maybeSingle();
    if (ex) custIds.set(c.phone, ex.id);
    else {
      const { data: cr } = await s.from("customers").insert({ phone: c.phone, name: c.name }).select("id").single();
      if (cr) custIds.set(c.phone, cr.id);
    }
  }

  let made = 0;
  for (let i = 0; i < N_ORDERS; i++) {
    const cust = rand(CUSTOMERS);
    const nLines = randInt(1, 2);
    const cart: CartLine[] = [];
    for (let l = 0; l < nLines; l++) {
      const pizza = rand(pizzas);
      const base = rand(bases);
      const sig = signature.get(pizza.id)!;
      const picked: MenuItemRef[] = [];
      // biased topping selection: usually the signature ones
      const nTop = randInt(0, 2);
      for (let t = 0; t < nTop; t++) {
        const cand = Math.random() < 0.7 ? rand(sig) : rand(toppings);
        if (!picked.some((x) => x.id === cand.id)) picked.push(cand);
      }
      cart.push({ base, pizza, toppings: picked, qty: randInt(1, 4) });
    }

    const bill = computeBill(cart, DEFAULT_PRICING);
    const placedAt = sampleWhen();
    const paymentMode = rand(["cash", "card", "upi"]);
    const orderCode = `PMH-${placedAt.getTime()}-${i}`;

    const { data: ord } = await s
      .from("orders")
      .insert({
        order_code: orderCode,
        token: randInt(1, 40),
        customer_id: custIds.get(cust.phone),
        name: cust.name,
        phone: cust.phone,
        status: "delivered",
        payment_mode: paymentMode,
        payment_status: paymentMode === "cash" ? "pending" : "paid",
        quantity_total: bill.quantity_total,
        subtotal_paise: bill.subtotal_paise,
        discount_paise: bill.discount_paise,
        gst_paise: bill.gst_paise,
        total_paise: bill.total_paise,
        placed_at: placedAt.toISOString(),
        confirmed_at: placedAt.toISOString(),
      })
      .select("id")
      .single();
    if (!ord) continue;

    for (let li = 0; li < cart.length; li++) {
      const line = cart[li];
      const { data: item } = await s
        .from("order_items")
        .insert({
          order_id: ord.id,
          base_id: line.base.id,
          pizza_id: line.pizza.id,
          qty: line.qty,
          unit_paise: bill.lines[li].unit_paise,
          line_paise: bill.lines[li].line_paise,
          is_veg: bill.lines[li].is_veg,
        })
        .select("id")
        .single();
      if (item && line.toppings.length) {
        await s.from("order_item_toppings").insert(
          line.toppings.map((t) => ({ order_item_id: item.id, topping_id: t.id, price_paise: t.price_paise })),
        );
      }
    }
    made++;
  }

  console.log(`Seeded ${made} historical orders across ${DAYS} days.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
