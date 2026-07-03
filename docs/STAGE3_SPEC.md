# SliceMatic — Stage 3 Technical Specification

**Full-Stack AI Ordering + Delivery System**
FDE Batch 2487 · PizzaFlow Applied Project · Stage 3 (50 pts + up to 10 bonus)

> This document is the implementation-ready spec. It preserves **all** Stage 2
> business logic (validation, discount, GST, payment, order persistence) and
> rebuilds the product as a production web app: a Zomato/Dominos-style **builder
> UI** for customers (no chatbot for end users), an **admin console**
> (analytics + kitchen), a **rider app**, **delivery with a 4 km geofence**, a
> **Postgres** datastore, and **two AI features** (Recommendation Engine +
> Demand Forecasting → +10 bonus).

---

## 0. Locked design decisions

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| D1 | Customer auth | **Phone + OTP, mocked in demo** (fixed dev code `123456`, no live SMS). Real SMS provider is a config swap. | Production-shaped flow, zero SMS cost/risk on demo day. |
| D2 | Delivery location | **Browser geolocation → Haversine → block > 4 km.** Reverse-geocode for a display address. | No paid maps key; deterministic; coords stored on the order. |
| D3 | App topology | **One Next.js (App Router) app**, role-based route groups `(customer)`, `admin`, `rider`. One Vercel project. | Simplest to ship + demo; shared types & pricing lib. |
| D4 | Payments | **Razorpay live via server-side route** with HMAC signature + webhook verification. Cash (COD) also offered. | Reuses existing keys; real integration; secret never on client. |
| D5 | AI features | **Both** Option A (Recommendation) **and** Option C (Demand Forecasting) via OpenRouter / scikit-learn → **+10 bonus**. | Highest score; both reuse the same order history. |

---

## 1. Scope & rubric mapping

### 1.1 What we build

**Customer (web, builder UI):** phone login → personalized AI suggestion → browse
menu → build pizza (base → pizza → toppings → qty) → cart → address + geofence →
pay (Razorpay/COD) → confirmation + **live order tracking**.

**Admin console:** Supabase-Auth login → orders table (filter by date + payment
mode) → revenue summary, top-selling pizza, busiest hour → **CSV export** →
**live kitchen board** → **demand-forecast chart**.

**Rider app:** rider login → assigned deliveries → status transitions
(picked up → out for delivery → delivered) → map/nav deep-link.

### 1.2 Rubric coverage

| Stage 3 rubric item | Pts | Covered by |
|---|---|---|
| Vercel frontend — live, responsive, full flow | 10 | §7 Customer app, §12 Deployment |
| Supabase DB — 3+ tables, orders saved, menu from DB, admin dashboard | 12 | §4 Schema, §8 Admin |
| Auth + admin dashboard — login, filters, revenue, CSV | 8 | §6 Auth, §8 Admin |
| AI feature — OpenRouter, documented prompt, real UX value | 12 | §9 Recommendation |
| Live demo + Q&A | 8 | §13 Demo prep |
| **Bonus** — 2nd AI feature | +10 | §10 Forecasting |

**Beyond-brief additions (your product asks):** builder UI, phone login,
rider app, 4 km delivery geofence, real-time tracking. These are additive and
never break the graded Stage 2 logic (§5).

---

## 2. Architecture

```
                         ┌────────────────────────────────────────────┐
                         │            Vercel (Next.js App Router)        │
                         │                                              │
   Customer  ─────────▶  │  (customer)  builder UI, cart, tracking      │
   Admin     ─────────▶  │  /admin      orders, revenue, kitchen, ML    │
   Rider     ─────────▶  │  /rider      assigned deliveries             │
                         │                                              │
                         │  Route Handlers / Server Actions             │
                         │   • pricing engine (authoritative)           │
                         │   • Razorpay create/verify/webhook           │
                         │   • OpenRouter recommendation call           │
                         │   • Supabase service-role writes             │
                         └───────┬───────────────────────┬──────────────┘
                                 │ supabase-js           │ https
                                 ▼                       ▼
        ┌────────────────────────────────┐     ┌───────────────────┐
        │   Supabase                     │     │  OpenRouter API   │
        │   • Postgres (menu/orders/…)   │     │  (LLM: recommend) │
        │   • Auth (admin, rider)        │     └───────────────────┘
        │   • Realtime (kitchen/track)   │
        │   • Storage (receipts, opt.)   │     ┌───────────────────┐
        └───────────────┬────────────────┘     │  Razorpay         │
                        │ read history          │  (payments)       │
                        ▼                       └───────────────────┘
              ┌──────────────────────┐
              │  Forecast job (Py)   │  scheduled: train sklearn on
              │  scikit-learn        │  order history → writes
              │  (Render/GH Action)  │  demand_forecasts table
              └──────────────────────┘
```

**Key principle — server is authoritative.** The browser never computes final
totals, never sees the Razorpay secret, never writes orders directly with a
privileged key. All money math and all order writes go through server code that
re-reads prices from Postgres.

---

## 3. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | **Next.js 15 (App Router) + React 19 + TypeScript** | Deployed on Vercel. |
| Styling | **Tailwind CSS** + a small component set (shadcn/ui optional) | Zomato-style cards/grids. |
| DB | **Supabase Postgres** | Menu, orders, deliveries, config. |
| Auth | **Supabase Auth** | Admin/rider = email+password; customer = phone OTP (mock code in demo). |
| Realtime | **Supabase Realtime** | Kitchen board, order tracking, rider assignment. |
| Payments | **Razorpay** | Orders API + Checkout.js + webhook, verified server-side. |
| AI (rec) | **OpenRouter** (OpenAI-compatible REST) | Called from a server route; key server-only. |
| AI (forecast) | **Python + scikit-learn** | Separate job; writes predictions to a table. |
| Charts | **Recharts** | Admin analytics + forecast chart (see `dataviz` skill before building). |
| Deploy | **Vercel** (web) + **Supabase** (data) + **Render/GitHub Action** (Py job) | One public URL. |

---

## 4. Data model (Postgres)

> Brief requires **separate tables for menus, orders, and order line items**.
> We exceed that. Money is stored as **integer paise** everywhere (no floats).

### 4.1 Enums

```sql
create type item_category  as enum ('base','pizza','topping');
create type order_status   as enum ('placed','confirmed','preparing','ready','out_for_delivery','delivered','cancelled');
create type payment_mode    as enum ('cash','card','upi');
create type payment_status  as enum ('pending','paid','failed','refunded');
create type delivery_status as enum ('unassigned','assigned','picked_up','out_for_delivery','delivered','failed');
create type app_role        as enum ('admin','rider');   -- customers are phone-keyed, not auth users
```

### 4.2 Tables

**`settings`** — single-row business config. *This is what makes the "change
discount threshold 5→3 live" demo a one-line UPDATE, no redeploy.*

```sql
create table settings (
  id                smallint primary key default 1 check (id = 1),
  shop_lat          double precision not null default 28.5905,   -- New Ashok Nagar
  shop_lng          double precision not null default 77.3037,
  delivery_radius_km numeric(4,2)    not null default 4.00,
  discount_threshold smallint        not null default 5,          -- qty >= this → discount
  discount_pct       numeric(5,2)    not null default 10.00,
  gst_pct            numeric(5,2)    not null default 18.00,
  max_pizzas         smallint        not null default 10,
  max_toppings       smallint        not null default 5,
  updated_at         timestamptz     not null default now()
);
insert into settings (id) values (1);
```

**`menu_items`** — all three categories in one table (satisfies "menus"; keeps
pricing joins simple). Loaded from the same `ID;Name;Price[;V|NV]` files at seed
time — **never hardcoded**.

```sql
create table menu_items (
  id           uuid primary key default gen_random_uuid(),
  category     item_category not null,
  external_id  text not null,                 -- the ID column from the .txt file
  name         text not null,
  price_paise  integer not null check (price_paise > 0),
  is_veg       boolean,                        -- from V/NV, nullable if unspecified
  is_available boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  unique (category, external_id)
);
create index on menu_items (category) where is_available;
```

**`customers`** — phone-keyed (name optional). Created on first login.

```sql
create table customers (
  id         uuid primary key default gen_random_uuid(),
  phone      text not null unique,             -- validated: ^[6-9][0-9]{9}$
  name       text,                             -- optional
  created_at timestamptz not null default now()
);
```

**`profiles`** — links Supabase `auth.users` → role for admin/rider.

```sql
create table profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  role       app_role not null,
  full_name  text,
  phone      text,
  created_at timestamptz not null default now()
);
```

**`orders`** — one row per order. Totals are a **server-computed snapshot**;
line items hold the itemisation.

```sql
create table orders (
  id                 uuid primary key default gen_random_uuid(),
  order_code         text not null unique,            -- e.g. PM-20260703-193045
  token              integer not null,                -- daily kitchen token
  customer_id        uuid not null references customers(id),
  name               text,                            -- snapshot at order time
  phone              text not null,                   -- snapshot
  status             order_status  not null default 'placed',
  payment_mode       payment_mode  not null,
  payment_status     payment_status not null default 'pending',
  quantity_total     integer not null check (quantity_total between 1 and 10),
  subtotal_paise     integer not null,
  discount_paise     integer not null default 0,
  gst_paise          integer not null,
  total_paise        integer not null,
  razorpay_order_id  text,
  razorpay_payment_id text,
  placed_at          timestamptz not null default now(),
  confirmed_at       timestamptz,
  created_at         timestamptz not null default now()
);
create index on orders (placed_at desc);
create index on orders (payment_mode);
create index on orders (status);
create index on orders (customer_id);
```

**`order_items`** — one row per pizza line (base + pizza + qty).

```sql
create table order_items (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references orders(id) on delete cascade,
  base_id     uuid not null references menu_items(id),
  pizza_id    uuid not null references menu_items(id),
  qty         integer not null check (qty between 1 and 10),
  unit_paise  integer not null,                -- base + pizza + toppings, per unit
  line_paise  integer not null,                -- unit_paise * qty
  is_veg      boolean
);
create index on order_items (order_id);
create index on order_items (pizza_id);       -- top-selling-pizza query
```

**`order_item_toppings`** — normalized toppings per line.

```sql
create table order_item_toppings (
  order_item_id uuid not null references order_items(id) on delete cascade,
  topping_id    uuid not null references menu_items(id),
  price_paise   integer not null,              -- snapshot of topping price
  primary key (order_item_id, topping_id)
);
```

**`deliveries`** — one per delivery order; holds geofence + rider assignment.

```sql
create table deliveries (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null unique references orders(id) on delete cascade,
  rider_id         uuid references profiles(id),
  status           delivery_status not null default 'unassigned',
  dropoff_lat      double precision not null,
  dropoff_lng      double precision not null,
  dropoff_address  text,
  distance_km      numeric(5,2) not null,       -- Haversine at order time, must be <= radius
  assigned_at      timestamptz,
  picked_up_at     timestamptz,
  delivered_at     timestamptz
);
create index on deliveries (rider_id, status);
```

**`ai_recommendations`** — cache of LLM suggestions (per customer/day).

```sql
create table ai_recommendations (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id),
  model       text not null,
  prompt      text not null,                    -- exact prompt sent (for README/debug)
  response    jsonb not null,                   -- {pizza, base, topping, reason}
  created_at  timestamptz not null default now()
);
create index on ai_recommendations (customer_id, created_at desc);
```

**`forecast_runs` / `demand_forecasts`** — output of the ML job.

```sql
create table forecast_runs (
  id           uuid primary key default gen_random_uuid(),
  generated_at timestamptz not null default now(),
  model        text not null,                   -- 'RandomForestRegressor' | 'LinearRegression'
  features     text not null,                   -- documented feature list
  rmse         numeric(8,3) not null,           -- test RMSE
  notes        text
);
create table demand_forecasts (
  id            uuid primary key default gen_random_uuid(),
  run_id        uuid not null references forecast_runs(id) on delete cascade,
  target_date   date not null,
  hour          smallint not null check (hour between 0 and 23),
  day_of_week   smallint not null check (day_of_week between 0 and 6),
  predicted_orders numeric(6,2) not null,
  is_peak       boolean not null default false   -- flag for top-3 peaks
);
create index on demand_forecasts (run_id, target_date, hour);
```

### 4.3 Row-Level Security (RLS)

- **`menu_items`, `settings`:** public `select` where available; write only via
  service role / admin.
- **`orders`, `order_items`, `deliveries`:** RLS **on**. Admin (JWT role=admin)
  reads/updates all. Rider reads/updates only deliveries where
  `rider_id = auth.uid()`. **Customer order writes go through server routes using
  the service-role key** (customer has no Supabase session in the mock-OTP model),
  scoped by the validated phone from the customer's signed session cookie.
- Never expose the service-role key to the browser. Client uses the anon key +
  RLS only for public menu reads and authenticated admin/rider reads.

### 4.4 File→DB migration / seeding

1. **Menu seed:** a one-off script parses `Types_of_Base.txt`,
   `Types_of_Pizza.txt`, `Types_of_Toppings.txt` (reuse Stage 2's defensive
   parser) and upserts into `menu_items` keyed by `(category, external_id)`.
   Re-runnable so the grader's file swap re-seeds cleanly.
2. **History import (for analytics + forecasting demo):** parse the existing
   `orders_log.txt` (125 seeded orders spanning a month) into `orders` /
   `order_items` so the admin dashboard and the ML model have real data on day one.

---

## 5. Preserved Stage 2 business logic (server-authoritative)

Ported to a **shared TypeScript module** `lib/pricing.ts` used by every order
write. Parameters read from `settings` (so they're changeable live).

### 5.1 Validation (identical rules to Stage 2)

| Field | Rule | Error copy (reuse Stage 2 strings) |
|---|---|---|
| Name | letters+spaces, 2–40 chars (optional in Stage 3 → allowed empty) | "Please enter a valid name using letters and spaces only (2–40 characters)." |
| Phone | `^[6-9][0-9]{9}$` | "Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9." |
| Quantity (per line) | int 1..`max_pizzas`; cart total ≤ `max_pizzas` | "Maximum {max} pizzas per order." |
| Menu selection | must be an existing available `menu_items.id` of the right category | reject unknown/unavailable id |
| Toppings | ≤ `max_toppings`, no duplicates | "Maximum {n} toppings per pizza." |
| Payment mode | one of cash/card/upi | "Invalid choice." |

Validation runs **twice**: client-side for UX, and **again server-side** as the
source of truth (never trust the client).

### 5.2 Pricing engine (exact Stage 2 semantics)

```
unit_paise(line)  = base.price + pizza.price + Σ topping.price
line_paise(line)  = unit_paise * qty
subtotal_paise    = Σ line_paise
discount_paise    = round(subtotal * discount_pct/100)   if total_qty >= discount_threshold else 0
taxable_paise     = subtotal - discount
gst_paise         = round(taxable * gst_pct/100)
total_paise       = taxable + gst
```

- Rounding: **banker's rounding (ROUND_HALF_EVEN)** on integer paise, matching
  Stage 2. Unit-test parity against the Python implementation with shared
  fixtures.
- The **discount threshold, discount %, and GST % come from `settings`** — the
  live-modify demo is `update settings set discount_threshold = 3;` and the next
  order reflects it with no deploy.

### 5.3 Order persistence

Replaces `orders_log.txt` append with an atomic Postgres transaction:
`insert orders` → `insert order_items` → `insert order_item_toppings` →
(`insert deliveries` if delivery) — all in **one transaction** (a Postgres
function / RPC), which **eliminates the Stage 2 concurrency race** on the flat
files entirely.

---

## 6. Auth & roles

| Actor | Method | Session | Access |
|---|---|---|---|
| Customer | Phone + OTP. **Demo:** fixed code `123456`, no SMS sent. Prod: swap in MSG91/Twilio via Supabase phone auth or a custom OTP table. | Signed httpOnly cookie holding verified phone | Own orders + tracking (via server routes) |
| Admin | Supabase Auth email+password; `profiles.role='admin'` | Supabase session | `/admin/*`, all orders, settings |
| Rider | Supabase Auth email+password; `profiles.role='rider'` | Supabase session | `/rider/*`, own assigned deliveries |

- Middleware (`middleware.ts`) gates `/admin` and `/rider` route groups by role
  claim; unauthenticated → redirect to the relevant login.
- OTP flow (mock): `POST /api/auth/otp/request` (no-op that "sends" code) →
  `POST /api/auth/otp/verify` (accepts `123456`) → upsert `customers` by phone →
  set signed cookie. A single env flag `OTP_MOCK=true` toggles real vs mock.

---

## 7. Customer app — builder UX (no chatbot)

Route group `(customer)` — mobile-first, Zomato/Dominos feel.

### 7.1 Screen flow

```
/login ──▶ /                ──▶ /build/[pizzaId] ──▶ /cart ──▶ /checkout ──▶ /order/[code]
 phone     menu + AI banner     base·toppings·qty    review     addr+pay      confirm+track
```

1. **`/login`** — phone field (name optional), OTP screen (demo autofills hint
   "use 123456").
2. **`/` (menu home)** — top **AI suggestion banner** (§9): "Hi Rahul, try a
   *Paneer Tikka on Cheese Burst + Extra Cheese* — you loved it last week."
   Below: menu grid of pizzas (veg/non-veg dot, price, image placeholder),
   category chips, search.
3. **`/build/[pizzaId]` (the builder)** — the core Zomato-style step:
   - Choose **base** (radio cards, price delta shown).
   - Add **toppings** (multi-select chips, ≤ `max_toppings`, running price).
   - **Quantity** stepper (1..remaining capacity).
   - Live line price; "Add to cart" (validated).
4. **`/cart`** — itemised bill rendered like Stage 2: per-line base+pizza+
   toppings, unit price, qty, line total, then **discount** (if qty≥threshold),
   **GST 18%**, **payable**. Totals fetched from the server (`POST /api/cart/price`)
   so the client never computes the authoritative number.
5. **`/checkout`** —
   - **Geolocation** prompt → Haversine to shop → if > radius, block with
     "Sorry, you're {d} km away — we deliver within {radius} km of New Ashok
     Nagar." Reverse-geocode to a display address (editable label).
   - **Payment mode**: Cash (COD) / Card / UPI.
   - Card/UPI → Razorpay Checkout (§11). Cash → place immediately.
6. **`/order/[code]`** — confirmation (token, ETA) + **live tracking** via
   Supabase Realtime on `orders.status` / `deliveries.status`
   (Placed → Preparing → Ready → Out for delivery → Delivered).

### 7.2 Notes

- Every price/total on screen is confirmed by a server response before payment.
- Accessibility + responsive per the `dataviz`/`artifact-design` conventions.

---

## 8. Admin console (`/admin`)

1. **Login** (Supabase Auth).
2. **Orders table** — columns: token, time, customer, items, total, payment
   mode, status. **Filters: date range + payment mode** (brief-mandated).
   Server-side pagination + indexes.
3. **Summary tiles** — **total revenue**, order count, AOV, **top-selling pizza**
   (`order_items` grouped by `pizza_id`), **busiest hour**
   (`orders` grouped by `hour(placed_at)`).
4. **CSV export** — streams filtered orders as CSV (brief-mandated).
5. **Kitchen board** — real-time pending/done cards (port Stage 2's kitchen
   renderer), daily token reset, "Mark done" → `orders.status='ready'`, updates
   via Realtime. Bounded to today.
6. **Demand-forecast panel** (§10) — Recharts line/bar of predicted orders by
   hour for the next 7 days + **top-3 peak hours** + model/RMSE caption.
7. **Settings** — edit `settings` (discount threshold/%, GST, radius) from the
   UI → backs the live-modify demo.

---

## 9. AI Feature A — Recommendation Engine (OpenRouter)

**Trigger:** right after login, before menu selection. **Server route**
`POST /api/ai/recommend` (key stays server-side).

**Flow:**
1. Load the customer's past orders from Postgres (last N orders: pizzas, bases,
   toppings, veg/non-veg, frequency).
2. If **no history** → skip LLM, show a popularity-based pick (deterministic
   fallback).
3. Else build the prompt, call OpenRouter (chat completions, `response_format`
   JSON), parse `{pizza, base, topping, reason}`.
4. **Validate** the returned names against `menu_items` (LLM may hallucinate);
   if invalid, fall back to popularity. Cache in `ai_recommendations`.
5. Render as the home banner with a one-tap "Build this".

**Model choice (document in README):** route to a **fast, inexpensive model** via
OpenRouter (latency matters — it's on the critical path before the menu). Pick a
current small model at build time and record the exact OpenRouter model id and
*why* (cost + latency) in the README. Set `max_tokens` low; the output is a tiny
JSON object.

**System prompt (documented, versioned in README):**

```
You are SliceMatic's menu concierge for a single pizza outlet in Delhi.
You are given a customer's past order history and the current menu.
Recommend exactly ONE combination: one pizza, one base, and one optional topping,
chosen ONLY from the provided menu lists. Prefer items similar to what the
customer ordered before; respect veg/non-veg preference inferred from history.
Return STRICT JSON: {"pizza": "...", "base": "...", "topping": "..."|null,
"reason": "<=15 words, friendly, references their history"}.
Do not invent items not in the menu. Do not add commentary outside the JSON.
```

**Inputs to the user message:** compact JSON of `{history:[...], menu:{bases,
pizzas, toppings}}`. **Guardrails:** server-side name validation, JSON parse
with retry-once, hard fallback, per-customer/day cache to bound cost.

---

## 10. AI Feature B (bonus) — Demand Forecasting (scikit-learn)

**Goal:** predict order volume by hour-of-day × day-of-week; show forecast +
**top-3 predicted peak hours for the next 7 days** on the admin dashboard.
Because Vercel runs Node (no sklearn), the model runs as a **separate Python
job** that writes results to Postgres; the admin UI just reads a table.

**Pipeline:**
1. **Data:** pull historical orders from Postgres (import `orders_log.txt` first
   so there's a month of data). Aggregate to counts per `(date, hour)`.
2. **Features:** `hour_of_day`, `day_of_week`, `is_weekend`, and optionally
   rolling/lag features (prev-week same-slot count).
3. **Model:** `RandomForestRegressor` (baseline `LinearRegression` for
   comparison). **Time-based train/test split** (last week held out).
4. **Metric:** **RMSE** on the holdout — recorded in `forecast_runs.rmse`.
5. **Output:** predict the next 7 days × 24 hours → write rows to
   `demand_forecasts`; flag the top-3 highest-predicted slots as `is_peak`.
6. **Serve:** admin dashboard reads `demand_forecasts` + latest `forecast_runs`
   and renders a Recharts chart with the RMSE + model caption.

**Where it runs:** a scheduled **GitHub Action** or small **Render cron** (daily)
running `forecast/train.py`; it can reuse the existing `slicematic` Python package
for parsing/business types. Document model, features, and RMSE in the README.

---

## 11. Payments — Razorpay (server-verified)

```
client                     Next.js server route              Razorpay
  │  place order (COD?) ───────▶ create order (txn) │
  │                              if card/upi:        │
  │  ◀── razorpay_order_id ───── orders.create ──────────────▶ (secret)
  │  open Checkout.js (key_id, order_id)                       │
  │  pay ──────────────────────────────────────────────────▶  │
  │  ◀── payment_id, order_id, signature ──────────────────────┘
  │  POST /verify ───────────▶ verify HMAC(order_id|payment_id, secret)
  │                            valid → payment_status='paid', confirm order,
  │                            enqueue kitchen
  │  webhook (async) ────────▶ /api/webhooks/razorpay  (verify webhook secret;
  │                            payment.captured / payment.failed = source of truth)
```

- **Secret + webhook secret are server-only env vars.** Client gets only the
  public `key_id` + `order_id`.
- Amount is recomputed server-side from the DB order — never taken from the
  client.
- Cash (COD): `payment_status='pending'`, order confirmed immediately, collected
  on delivery.
- Reuse the Stage 2 knowledge: test keys can't use the QR API — Checkout.js
  handles UPI/Card natively here, so the base64-QR workaround is no longer needed.

---

## 12. Delivery & geofencing

- **Shop origin** from `settings.shop_lat/lng` (New Ashok Nagar ≈ 28.5905,
  77.3037).
- **At checkout:** browser `navigator.geolocation` → server computes **Haversine**
  distance to shop. If `distance_km > settings.delivery_radius_km` → **reject**
  with a clear message; else store `dropoff_lat/lng/address/distance_km` on the
  `deliveries` row.
- **Assignment:** admin (or auto) assigns an available rider → `deliveries.status`
  transitions; rider app drives `picked_up → out_for_delivery → delivered`,
  which flips `orders.status` for the customer's live tracker.
- **Rider nav:** deep-link to Google Maps with the dropoff coords (no paid API).

**Delivery state machine:**
```
unassigned → assigned → picked_up → out_for_delivery → delivered
                     └────────────────────────────────▶ failed
order.status mirror: placed → confirmed → preparing → ready → out_for_delivery → delivered
```

---

## 13. Rider app (`/rider`)

- Login → **assigned deliveries** list (order token, address, distance, items).
- One order detail → **Navigate** (maps deep-link) → status buttons (Picked up /
  Out for delivery / Delivered).
- Real-time: new assignments appear without refresh (Realtime on `deliveries`
  where `rider_id = me`).
- Mobile-first; if you later want offline/home-screen, promote to a PWA (D3 note).

---

## 14. Non-functional requirements

- **Security:** RLS on all order tables; service-role key server-only; Razorpay
  secret + webhook secret server-only; OpenRouter key server-only; HMAC
  verification on payment + webhook; input re-validated server-side.
- **Correctness:** integer-paise math; banker's rounding; totals never trusted
  from client; menu selections validated against DB.
- **Performance:** indexes on `orders(placed_at, payment_mode, status)`,
  `order_items(pizza_id, order_id)`, `deliveries(rider_id, status)`. Postgres
  aggregation replaces the Stage 2 full-file re-parse (the 4 s@100k problem is
  gone — indexed `group by` is ms-scale).
- **Concurrency:** single-transaction order writes remove the flat-file race.
- **Resilience:** AI + forecast are non-blocking with deterministic fallbacks;
  payment webhook is the async source of truth if the client drops.
- **Observability:** log payment verification + webhook events; keep the exact
  AI prompt/response in `ai_recommendations`.

---

## 15. Repository layout

```
slice-matic-web/
├─ app/
│  ├─ (customer)/           # login, menu, build, cart, checkout, order/[code]
│  ├─ admin/                # orders, revenue, kitchen, forecast, settings
│  ├─ rider/                # deliveries, detail
│  └─ api/
│     ├─ auth/otp/          # request, verify (mock)
│     ├─ cart/price/        # authoritative pricing
│     ├─ orders/            # create (txn), get
│     ├─ payments/          # create, verify, webhooks/razorpay
│     └─ ai/recommend/      # OpenRouter call
├─ lib/
│  ├─ pricing.ts            # ported Stage 2 engine (reads settings)
│  ├─ validators.ts         # ported Stage 2 validators
│  ├─ geo.ts                # haversine
│  ├─ supabase/             # server (service role) + browser (anon) clients
│  └─ razorpay.ts           # server helpers + signature verify
├─ components/              # menu cards, builder, bill, kitchen board, charts
├─ middleware.ts            # role gating for /admin, /rider
├─ supabase/
│  ├─ migrations/           # schema SQL (§4)
│  └─ seed/                 # menu seed + orders_log import
├─ forecast/                # Python: train.py, requirements.txt (separate deploy)
└─ README.md                # architecture diagram, setup, AI prompt+model, RMSE
```

---

## 16. Environment variables

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # server only

# Razorpay
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=                # server only
RAZORPAY_WEBHOOK_SECRET=            # server only
NEXT_PUBLIC_RAZORPAY_KEY_ID=        # public key id for Checkout.js

# OpenRouter
OPENROUTER_API_KEY=                 # server only
OPENROUTER_MODEL=                   # documented in README

# Auth / OTP
OTP_MOCK=true                       # demo: accept 123456, no SMS
```

---

## 17. Build order (dependency-ordered, not calendar-bound)

1. **DB first:** migrations (§4) + menu seed + `orders_log` import → data exists.
2. **Pricing/validation lib** (§5) with parity tests vs Python fixtures.
3. **Customer happy path:** login (mock OTP) → menu → builder → cart → COD
   checkout → order write (txn) → confirmation. *This alone earns the 10-pt
   "full flow live" once deployed.*
4. **Razorpay** card/upi (§11).
5. **Admin:** auth → orders+filters → revenue/top-pizza/busiest-hour → CSV.
6. **AI recommendation** (§9) — highest-value single AI item (12 pts).
7. **Geofence + delivery + rider app** (§12–13).
8. **Realtime** kitchen + tracking.
9. **Forecasting job + admin chart** (§10) — the +10 bonus.
10. **Deploy to Vercel + Supabase**, wire env, smoke-test the public URL.
11. **README** (architecture diagram, setup, AI prompt + model + why, RMSE) +
    Loom.

**Demo-day gate:** public URL loads; place a live order end-to-end; admin shows
it; AI banner renders; forecast chart renders; `update settings` changes discount
threshold live.

---

## 18. Live-demo Q&A prep (graders quiz each member)

- **"Explain a function"** → know `lib/pricing.ts` cold (discount gate, GST on
  post-discount, banker's rounding) and the order-write transaction.
- **"Walk a schema + justify"** → `orders` vs `order_items` vs
  `order_item_toppings` (why toppings are a child table, not a CSV column; why
  paise integers; why `settings` holds business params).
- **"Modify a live feature"** → `update settings set discount_threshold = 3;`
  (or via the Settings UI) → place a 3-qty order → discount now applies. No
  redeploy — this is why business params live in a table.

---

## 19. Open items / risks

- **OpenRouter model id** — pick a current small model at build; record exact id
  + rationale in README (don't hardcode a stale id).
- **Forecast hosting** — GitHub Action cron is free and simplest; Render if you
  want an on-demand "retrain" button in admin.
- **Real SMS** — only needed if you drop the mock; `OTP_MOCK=false` + provider.
- **AI-feature ownership rule** — brief says first team to commit a feature owns
  it; commit Recommendation + Forecasting early to claim both.
- **Images** — menu photos are placeholders unless you add an image column +
  Supabase Storage (nice-to-have, not graded).
```
