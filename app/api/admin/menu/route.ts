import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { validatePricePaise } from "@/lib/validators";

// Update a single menu item's price and/or availability. Admin-only.
// Because the whole app re-prices from menu_items server-side, a change here
// flows to the menu, cart, checkout, recommendations, and Sage on next load.
export async function PATCH(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ ok: false, error: "Missing item id." }, { status: 400 });

  const update: { price_paise?: number; is_available?: boolean } = {};

  if (body.price_paise !== undefined) {
    const price = validatePricePaise(body.price_paise);
    if (!price.ok) return NextResponse.json({ ok: false, error: price.error }, { status: 400 });
    update.price_paise = price.value;
  }

  if (body.is_available !== undefined) {
    if (typeof body.is_available !== "boolean") {
      return NextResponse.json({ ok: false, error: "is_available must be true or false." }, { status: 400 });
    }
    update.is_available = body.is_available;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: false, error: "Nothing to update." }, { status: 400 });
  }

  const svc = createAdminClient();
  const { data, error } = await svc
    .from("menu_items")
    .update(update)
    .eq("id", id)
    .select("id, name, category, price_paise, is_veg, is_available")
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: "Could not update the item." }, { status: 500 });
  if (!data) return NextResponse.json({ ok: false, error: "Item not found." }, { status: 404 });

  return NextResponse.json({ ok: true, item: data });
}
