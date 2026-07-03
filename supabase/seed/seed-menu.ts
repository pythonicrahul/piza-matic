/**
 * Seed `menu_items` from the ID;Name;Price[;V|NV] .txt files.
 *
 * Defensive parsing mirrors the Stage 2 loader: trim whitespace, skip malformed
 * lines, validate price is numeric > 0. Re-runnable (upsert on category+external_id),
 * so it also handles the grader swapping the menu files.
 *
 *   npm run seed:menu
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import type { ItemCategory } from "../../lib/types";

const HERE = dirname(fileURLToPath(import.meta.url));
const MENU_DIR = join(HERE, "menu");

const FILES: Record<ItemCategory, string> = {
  base: "Types_of_Base.txt",
  pizza: "Types_of_Pizza.txt",
  topping: "Types_of_Toppings.txt",
};

interface Row {
  category: ItemCategory;
  external_id: string;
  name: string;
  price_paise: number;
  is_veg: boolean | null;
  sort_order: number;
}

function priceToPaise(raw: string): number | null {
  const v = Number(raw.trim());
  if (!Number.isFinite(v) || v <= 0) return null;
  return Math.round(v * 100);
}

function parseVeg(raw: string | undefined): boolean | null {
  const t = (raw ?? "").trim().toUpperCase();
  if (t === "V") return true;
  if (t === "NV") return false;
  return null;
}

function parseFile(category: ItemCategory): Row[] {
  const path = join(MENU_DIR, FILES[category]);
  const lines = readFileSync(path, "utf-8").split(/\r?\n/);
  const rows: Row[] = [];
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    const parts = line.split(";");
    if (parts.length < 3 || parts.length > 4) {
      console.warn(`[${FILES[category]}:${i + 1}] expected 3-4 fields, got ${parts.length} — skipped`);
      return;
    }
    const external_id = parts[0].trim();
    const name = parts[1].trim();
    const price_paise = priceToPaise(parts[2]);
    if (!external_id || !name) {
      console.warn(`[${FILES[category]}:${i + 1}] missing id or name — skipped`);
      return;
    }
    if (price_paise === null) {
      console.warn(`[${FILES[category]}:${i + 1}] invalid price '${parts[2]}' — skipped`);
      return;
    }
    rows.push({ category, external_id, name, price_paise, is_veg: parseVeg(parts[3]), sort_order: rows.length });
  });
  if (rows.length === 0) throw new Error(`No valid items in ${FILES[category]}`);
  return rows;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env");

  const supabase = createClient(url, secret, { auth: { persistSession: false } });

  const rows: Row[] = [
    ...parseFile("base"),
    ...parseFile("pizza"),
    ...parseFile("topping"),
  ];

  const { error } = await supabase
    .from("menu_items")
    .upsert(rows, { onConflict: "category,external_id" });
  if (error) throw error;

  const counts = rows.reduce<Record<string, number>>((a, r) => ((a[r.category] = (a[r.category] ?? 0) + 1), a), {});
  console.log(`Seeded menu_items:`, counts, `(total ${rows.length})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
