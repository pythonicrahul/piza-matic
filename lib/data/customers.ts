import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { validateName, validatePhone } from "@/lib/validators";

export interface Customer {
  id: string;
  phone: string;
  name: string | null;
}

/** Look up a customer by phone (no create). Used to tell sign-in from sign-up. */
export async function getCustomerByPhone(phone: string): Promise<Customer | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("customers")
    .select("id, phone, name")
    .eq("phone", phone)
    .maybeSingle();
  return (data as Customer) ?? null;
}

/**
 * Look up a customer by phone, creating them on first login. If a non-empty name
 * is supplied and differs from what's stored, it's updated (name is optional, so
 * we never overwrite an existing name with null).
 */
export async function getOrCreateCustomer(
  phone: string,
  name?: string | null,
): Promise<Customer> {
  // Defense in depth: never persist an unvalidated phone/name, even if a future
  // caller forgets to validate first. Phone is normalized to canonical 10 digits.
  const validPhone = validatePhone(phone);
  if (!validPhone.ok) throw new Error(validPhone.error);
  phone = validPhone.value;
  if (name != null && name.trim() !== "") {
    const validName = validateName(name);
    if (!validName.ok) throw new Error(validName.error);
    name = validName.value;
  }

  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("customers")
    .select("id, phone, name")
    .eq("phone", phone)
    .maybeSingle();

  if (existing) {
    if (name && name.trim() && name !== existing.name) {
      const { data: updated } = await supabase
        .from("customers")
        .update({ name })
        .eq("id", existing.id)
        .select("id, phone, name")
        .single();
      return updated ?? existing;
    }
    return existing;
  }

  const { data: created, error } = await supabase
    .from("customers")
    .insert({ phone, name: name ?? null })
    .select("id, phone, name")
    .single();
  if (error || !created) throw error ?? new Error("Failed to create customer");
  return created;
}

/** Recent orders for a customer, shaped for the AI recommendation prompt. */
export async function getCustomerHistory(customerId: string, limit = 10) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("orders")
    .select(
      "id, placed_at, order_items(pizza:pizza_id(name), base:base_id(name), order_item_toppings(topping:topping_id(name)))",
    )
    .eq("customer_id", customerId)
    .order("placed_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}
