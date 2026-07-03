-- SliceMatic Stage 3 — initial schema
-- Money is stored as integer paise everywhere. See docs/STAGE3_SPEC.md §4.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type item_category  as enum ('base','pizza','topping');
create type order_status   as enum ('placed','confirmed','preparing','ready','out_for_delivery','delivered','cancelled');
create type payment_mode    as enum ('cash','card','upi');
create type payment_status  as enum ('pending','paid','failed','refunded');
create type delivery_status as enum ('unassigned','assigned','picked_up','out_for_delivery','delivered','failed');
create type app_role        as enum ('admin','rider');

-- ---------------------------------------------------------------------------
-- settings — single-row business config (drives pricing + geofence).
-- Changing discount_threshold here is the "live modify" demo (no redeploy).
-- ---------------------------------------------------------------------------
create table settings (
  id                 smallint primary key default 1 check (id = 1),
  shop_lat           double precision not null default 28.5905,   -- New Ashok Nagar
  shop_lng           double precision not null default 77.3037,
  delivery_radius_km numeric(4,2)     not null default 4.00,
  discount_threshold smallint         not null default 5,
  discount_pct       numeric(5,2)     not null default 10.00,
  gst_pct            numeric(5,2)     not null default 18.00,
  max_pizzas         smallint         not null default 10,
  max_toppings       smallint         not null default 5,
  updated_at         timestamptz      not null default now()
);
insert into settings (id) values (1);

-- ---------------------------------------------------------------------------
-- menu_items — all categories in one table, loaded from the .txt files.
-- ---------------------------------------------------------------------------
create table menu_items (
  id           uuid primary key default gen_random_uuid(),
  category     item_category not null,
  external_id  text not null,                 -- ID column from the .txt file
  name         text not null,
  price_paise  integer not null check (price_paise > 0),
  is_veg       boolean,                        -- from V/NV; null if unspecified
  is_available boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  unique (category, external_id)
);
create index menu_items_available_idx on menu_items (category) where is_available;

-- ---------------------------------------------------------------------------
-- customers — phone-keyed (name optional). Created on first login.
-- ---------------------------------------------------------------------------
create table customers (
  id         uuid primary key default gen_random_uuid(),
  phone      text not null unique,             -- ^[6-9][0-9]{9}$
  name       text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- profiles — links Supabase auth.users → role for admin/rider.
-- ---------------------------------------------------------------------------
create table profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  role       app_role not null,
  full_name  text,
  phone      text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- orders — server-computed totals snapshot.
-- ---------------------------------------------------------------------------
create table orders (
  id                  uuid primary key default gen_random_uuid(),
  order_code          text not null unique,             -- PM-YYYYMMDD-HHMMSS
  token               integer not null,                 -- daily kitchen token
  customer_id         uuid not null references customers(id),
  name                text,
  phone               text not null,
  status              order_status   not null default 'placed',
  payment_mode        payment_mode   not null,
  payment_status      payment_status not null default 'pending',
  quantity_total      integer not null check (quantity_total between 1 and 10),
  subtotal_paise      integer not null,
  discount_paise      integer not null default 0,
  gst_paise           integer not null,
  total_paise         integer not null,
  razorpay_order_id   text,
  razorpay_payment_id text,
  placed_at           timestamptz not null default now(),
  confirmed_at        timestamptz,
  created_at          timestamptz not null default now()
);
create index orders_placed_at_idx  on orders (placed_at desc);
create index orders_payment_idx    on orders (payment_mode);
create index orders_status_idx     on orders (status);
create index orders_customer_idx   on orders (customer_id);

-- ---------------------------------------------------------------------------
-- order_items — one row per pizza line.
-- ---------------------------------------------------------------------------
create table order_items (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references orders(id) on delete cascade,
  base_id    uuid not null references menu_items(id),
  pizza_id   uuid not null references menu_items(id),
  qty        integer not null check (qty between 1 and 10),
  unit_paise integer not null,
  line_paise integer not null,
  is_veg     boolean
);
create index order_items_order_idx on order_items (order_id);
create index order_items_pizza_idx on order_items (pizza_id);

-- ---------------------------------------------------------------------------
-- order_item_toppings — normalized toppings per line.
-- ---------------------------------------------------------------------------
create table order_item_toppings (
  order_item_id uuid not null references order_items(id) on delete cascade,
  topping_id    uuid not null references menu_items(id),
  price_paise   integer not null,
  primary key (order_item_id, topping_id)
);

-- ---------------------------------------------------------------------------
-- deliveries — geofence + rider assignment (one per delivery order).
-- ---------------------------------------------------------------------------
create table deliveries (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null unique references orders(id) on delete cascade,
  rider_id        uuid references profiles(id),
  status          delivery_status not null default 'unassigned',
  dropoff_lat     double precision not null,
  dropoff_lng     double precision not null,
  dropoff_address text,
  distance_km     numeric(5,2) not null,       -- must be <= settings.delivery_radius_km
  assigned_at     timestamptz,
  picked_up_at    timestamptz,
  delivered_at    timestamptz
);
create index deliveries_rider_idx on deliveries (rider_id, status);

-- ---------------------------------------------------------------------------
-- ai_recommendations — cache of LLM suggestions.
-- ---------------------------------------------------------------------------
create table ai_recommendations (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id),
  model       text not null,
  prompt      text not null,
  response    jsonb not null,
  created_at  timestamptz not null default now()
);
create index ai_recs_customer_idx on ai_recommendations (customer_id, created_at desc);

-- ---------------------------------------------------------------------------
-- forecast_runs / demand_forecasts — output of the sklearn job.
-- ---------------------------------------------------------------------------
create table forecast_runs (
  id           uuid primary key default gen_random_uuid(),
  generated_at timestamptz not null default now(),
  model        text not null,
  features     text not null,
  rmse         numeric(8,3) not null,
  notes        text
);
create table demand_forecasts (
  id               uuid primary key default gen_random_uuid(),
  run_id           uuid not null references forecast_runs(id) on delete cascade,
  target_date      date not null,
  hour             smallint not null check (hour between 0 and 23),
  day_of_week      smallint not null check (day_of_week between 0 and 6),
  predicted_orders numeric(6,2) not null,
  is_peak          boolean not null default false
);
create index demand_forecasts_run_idx on demand_forecasts (run_id, target_date, hour);
