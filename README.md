# 🍕 SliceMatic

**Pizza, from craving to doorstep.** A full-stack ordering + delivery platform where
customers build (or *chat* their way to) the perfect pizza, admins run the kitchen and
watch demand forecasts roll in, and riders get their next drop auto-dispatched. Three
apps, one codebase.

Built with **Next.js 16 (App Router) · TypeScript · Tailwind v4**, **Supabase
Postgres/Auth**, **Razorpay** payments, a **scikit-learn** demand model, and
**OpenAI** doing two very different jobs — recommending *and* conversing.

---

## ✨ What makes it fun

- **🤖 Order with Sage** — a conversational assistant. Say *"I'm veg and want something
  cheesy and filling"* and it asks a couple of quick questions, then proposes a real
  pizza built **only** from the live menu (guardrailed so it can't hallucinate items or
  touch payment). Tap to drop it in your cart.
- **🎨 Zomato-style pizza builder** — pick a base, pile on toppings, watch the price
  update live, with a topping upsell driven by *"people who ordered this also added…"*
  co-occurrence data.
- **⏱️ Live delivery ETA** — every order shows a ticking estimate from
  `travel time (shop→you) + kitchen queue × 7 min`.
- **📍 Smart fulfilment** — 4 km delivery **geofence**, or auto-switch to
  take-away/dine-in when you're standing at the store.
- **📈 Demand forecasting** — a RandomForest trained on order history paints a 7-day ×
  24-hour heatmap of when the shop will be slammed.

## The three surfaces

- **Customer** (`/`) — phone (mock-OTP) login, pizza builder, **Sage** chat ordering, AI
  menu pick, cart + topping upsell, delivery/take-away, saved addresses, Razorpay or COD,
  live tracking with ETA, order history — all under an **iOS-style bottom tab bar**.
- **Admin** (`/admin`) — orders + filters + CSV, revenue / top pizza / busiest hour, a
  live kitchen board, **menu & price editor** (edit prices, "86" an item), rider
  onboarding + **FIFO auto-dispatch**, and the demand-forecast heatmap.
- **Rider** (`/rider`) — online toggle, current assignment, pickup → delivered, with the
  next queued delivery handed over automatically.

---

## 🚀 Quick start

```bash
npm install
cp .env.sample .env            # fill in Supabase / Razorpay / OpenAI keys (see below)

# database (Supabase CLI)
npx supabase login && npx supabase link --project-ref <your-ref>
npx supabase db push           # applies migrations (schema, RLS, RPCs)
npm run seed:menu              # load menu items from supabase/seed/menu/*.txt
npm run seed:admin             # create the admin login
npm run seed:orders            # optional: demo order history (analytics/upsell/forecast)

npm run dev                    # http://localhost:3000
```

**Admin** logs in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`; **riders** are onboarded from the
admin *Delivery* tab. Customer login OTP in demo mode is **`123456`**.

### Env (`.env`)

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
`SUPABASE_SECRET_KEY` · `RAZORPAY_KEY_ID/SECRET/WEBHOOK_SECRET` +
`NEXT_PUBLIC_RAZORPAY_KEY_ID` · `AI_PROVIDER` + `OPENAI_API_KEY`/`OPENAI_MODEL` ·
`SESSION_SECRET` · `OTP_MOCK`/`OTP_DEV_CODE` · `ADMIN_EMAIL`/`ADMIN_PASSWORD` ·
store: `NEXT_PUBLIC_SHOP_{NAME,AREA,LAT,LNG}` + `NEXT_PUBLIC_DELIVERY_RADIUS_KM` /
`NEXT_PUBLIC_TAKEAWAY_RADIUS_KM`.

### Scripts

`npm run dev | build | start | lint | test` · `seed:menu | seed:admin | seed:orders`
Demand forecast (Python): `pip install -r forecast/requirements.txt && python forecast/train.py`

---

## 🧠 The AI, three ways

| Feature | Engine | What it does |
|---|---|---|
| **Sage** chat ordering | OpenAI `gpt-4o-mini` | multi-turn chat → menu-validated pizza proposal ([deep dive](lib/ai/CHAT.md)) |
| **Menu recommendation** | OpenAI `gpt-4o-mini` | a personalized "top pick" from your order history |
| **Topping upsell** | Postgres SQL | co-occurrence: what people add to *this* pizza |
| **Demand forecast** | scikit-learn RandomForest | 7-day × 24-hour order heatmap + peak slots |

Both LLM features are **provider-agnostic** (`AI_PROVIDER=openai|openrouter`) and
**guardrailed**: proposals are re-validated against the live menu server-side, so the AI
can never invent an item, blow past topping caps, or reach the payment step.

---

## 🔌 API

Auth uses an httpOnly session cookie (customer) or Supabase Auth (admin/rider).

**Customer**
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/otp/request` · `/verify` | request / verify OTP (sets session) |
| GET · POST | `/api/auth/me` · `/api/auth/logout` | current session · sign out |
| POST | `/api/cart/price` | authoritative cart total |
| POST | `/api/cart/upsell` | topping suggestions per pizza |
| GET | `/api/ai/recommend` | personalized pizza pick |
| POST | `/api/ai/chat` | **Sage** conversational ordering |
| GET · POST · DELETE | `/api/addresses` | saved delivery addresses |
| POST | `/api/orders` | place an order (delivery/take-away) |
| POST | `/api/payments/create` · `/verify` | Razorpay order + signature verify |
| POST | `/api/webhooks/razorpay` | async payment status |

**Admin** (Supabase Auth, role=admin)
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/admin/kitchen` | live kitchen board feed |
| POST | `/api/admin/kitchen/done` | mark order ready (auto-dispatch) |
| PATCH | `/api/admin/menu` | edit item price / availability |
| GET | `/api/admin/orders/csv` | export filtered orders |
| POST · DELETE | `/api/admin/riders` | onboard / remove a rider |

**Rider** (Supabase Auth, role=rider)
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/rider/current` | current assignment + online state |
| POST | `/api/rider/online` | toggle availability |
| POST | `/api/rider/advance` | pickup → delivered |

---

## 💰 Business rules

Money is **integer paise** with banker's rounding — no floating-point cents to lose.
`unit = base + pizza + Σ toppings`; `discount = 10%` of subtotal when qty ≥ 5;
`GST = 18%` on (subtotal − discount); `total = subtotal − discount + GST`. **Pricing is
recomputed server-side from DB prices on every order** — client totals are never trusted,
so an edited price or a rogue AI suggestion can never produce a wrong bill. Business params
(discount threshold/%, GST) live in the `settings` table (changeable without a deploy);
store location + radii come from env.

## 🧪 Testing & deploy

`npm test` runs the **Vitest** suite — **98 tests** across pricing, money, validators, geo,
cart, the AI menu guardrails, Sage's proposal validation, order ETA, Razorpay signatures,
and admin utils. Deploy the app to **Vercel**, keep the data on **Supabase**, and mirror
the same env vars in the Vercel project. 🍕
