-- Saved delivery addresses per customer, so they don't re-enter location each time.
-- Distance to the store is NOT stored (the store can change) — it's recomputed at
-- checkout. Accessed only via server routes using the service role (customers
-- have no Supabase session), so RLS is on with no policies = locked to anon.

create table customer_addresses (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  label       text,               -- "Home", "Work", or null
  address     text,               -- flat / building / landmark
  lat         double precision not null,
  lng         double precision not null,
  created_at  timestamptz not null default now()
);
create index customer_addresses_customer_idx on customer_addresses (customer_id, created_at desc);

alter table customer_addresses enable row level security;
