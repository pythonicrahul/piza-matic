import { NextResponse } from "next/server";
import { getSettings } from "@/lib/data/settings";
import { getMenuMap } from "@/lib/data/menu";
import { CartError, repriceCart, type CartLinePayload } from "@/lib/cart";

// Authoritative pricing for a cart. The client calls this to display the bill;
// the same repricing runs again at order creation so displayed == charged.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const lines = body?.lines as CartLinePayload[] | undefined;
  if (!Array.isArray(lines)) {
    return NextResponse.json({ ok: false, error: "Invalid cart." }, { status: 400 });
  }

  const [settings, menu] = await Promise.all([getSettings(), getMenuMap()]);

  try {
    const { bill } = repriceCart(lines, menu, settings);
    return NextResponse.json({ ok: true, bill });
  } catch (e) {
    if (e instanceof CartError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
    }
    throw e;
  }
}
