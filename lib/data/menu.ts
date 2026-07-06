import "server-only";

// Server-side menu reads from the DB. The menu is the source of truth for
// pricing — the server always re-reads prices here, never trusting the client.

import { createAdminClient } from "@/lib/supabase/admin";
import type { ItemCategory, MenuItemRef } from "@/lib/types";

export interface MenuItem extends MenuItemRef {
  category: ItemCategory;
  external_id: string;
  is_available: boolean;
  sort_order: number;
}

export interface Menu {
  base: MenuItem[];
  pizza: MenuItem[];
  topping: MenuItem[];
}

const SELECT = "id, category, external_id, name, price_paise, is_veg, is_available, sort_order";

/** All available items grouped by category, ordered for display. */
export async function getMenu(): Promise<Menu> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("menu_items")
    .select(SELECT)
    .eq("is_available", true)
    .order("category")
    .order("sort_order");

  if (error) throw error;

  const menu: Menu = { base: [], pizza: [], topping: [] };
  for (const row of (data ?? []) as MenuItem[]) menu[row.category].push(row);
  return menu;
}

/** Every item incl. unavailable ones, grouped for the admin menu editor. */
export async function getFullMenu(): Promise<Menu> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("menu_items")
    .select(SELECT)
    .order("category")
    .order("sort_order");

  if (error) throw error;

  const menu: Menu = { base: [], pizza: [], topping: [] };
  for (const row of (data ?? []) as MenuItem[]) menu[row.category].push(row);
  return menu;
}

/**
 * A lookup of id → item for every available item, used to re-price a cart
 * server-side and to validate that submitted selections are real + available.
 */
export async function getMenuMap(): Promise<Map<string, MenuItem>> {
  const menu = await getMenu();
  const map = new Map<string, MenuItem>();
  for (const cat of ["base", "pizza", "topping"] as const) {
    for (const item of menu[cat]) map.set(item.id, item);
  }
  return map;
}
