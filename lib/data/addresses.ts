import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export interface SavedAddress {
  id: string;
  label: string | null;
  address: string | null;
  lat: number;
  lng: number;
}

export async function getCustomerAddresses(customerId: string): Promise<SavedAddress[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("customer_addresses")
    .select("id, label, address, lat, lng")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });
  return (data ?? []) as SavedAddress[];
}

export async function addCustomerAddress(
  customerId: string,
  a: { label?: string | null; address?: string | null; lat: number; lng: number },
): Promise<SavedAddress | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("customer_addresses")
    .insert({ customer_id: customerId, label: a.label || null, address: a.address || null, lat: a.lat, lng: a.lng })
    .select("id, label, address, lat, lng")
    .single();
  return (data as SavedAddress) ?? null;
}

export async function deleteCustomerAddress(customerId: string, id: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from("customer_addresses").delete().eq("id", id).eq("customer_id", customerId);
}
