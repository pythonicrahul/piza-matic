# 🍕 SliceMatic — Full-Stack AI Pizza Ordering & Delivery

A production-shaped pizza ordering web app: customers build a pizza (base → toppings → quantity), pay via Razorpay or cash, and track their order live; admins get analytics, CSV export, and a real-time kitchen board. An LLM-powered recommendation engine greets returning customers with a personalized pick.

**FDE Batch 2487 · PizzaFlow Applied Project · Stage 3** — full technical spec in [`docs/STAGE3_SPEC.md`](docs/STAGE3_SPEC.md).

---

## Features

**Customer** (`/`)
- Phone + OTP login (mocked for demo: code `123456`, no SMS cost)
- Photo-led menu with veg/non-veg filters and real food photography
- Zomato-style pizza builder: base (with crust photos), up to 5 toppings, quantity — live price as you build
- Server-authoritative cart pricing (discount + GST computed from DB prices, never trusted from the client)
- Floating cart bar, animated checkout with geolocation + 4 km delivery geofence
- Razorpay (card/UPI, HMAC-verified server-side) or Cash on Delivery
- Order confirmation with kitchen token + live status tracker
- ✨ AI recommendation banner personalized from order history

**Admin** (`/admin`)
- Supabase Auth login (email + password, role-gated by middleware)
- Revenue / order count / AOV / top-pizza tiles with count-up animation
- Orders-by-hour chart (Recharts), busiest-hour callout
- Orders table with date-range + payment-mode filters and **CSV export**
- Live **kitchen board**: pending orders with urgency accents, one-tap "Mark ready"

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) · React 19 · TypeScript |
| Styling / motion | Tailwind CSS v4 · Framer Motion |
| Charts | Recharts |
| Database & auth | Supabase (Postgres + Auth) |
| Payments | Razorpay (Orders API + Checkout.js + webhook) |
| AI | OpenAI SDK → OpenAI or OpenRouter (config swap) |
| Images | Unsplash CDN via `next/image`, with SVG-illustration fallback |
| Testing | Vitest (73 unit tests) |
| Hosting | Vercel |

## Architecture

```
                    ┌─────────────────────────────────────────────┐
                    │           Vercel (Next.js App Router)       │
                    │                                             │
 Customer ────────▶ │  (customer)/  menu · builder · cart ·       │
                    │               checkout · order/[code]       │
 Admin ───────────▶ │  admin/       dashboard · kitchen           │
                    │                                             │
                    │  app/api/*  Route Handlers (server-only)    │
                    │   • lib/pricing.ts  — authoritative money   │
                    │   • Razorpay create / verify / webhook      │
                    │   • OTP request / verify (mock or real)     │
                    │   • AI recommend (key never in browser)     │
                    └────────┬───────────────────┬────────────────┘
                             │ supabase-js       │ https
                             ▼                   ▼
              ┌──────────────────────┐   ┌──────────────────┐
              │ Supabase Postgres    │   │ OpenAI/OpenRouter│
              │  menu · orders ·     │   │ (recommendation) │
              │  deliveries · settings│  └──────────────────┘
              │  + Auth (admin)      │   ┌──────────────────┐
              └──────────────────────┘   │ Razorpay         │
                                         └──────────────────┘
```

**Key principle — the server is authoritative.** The browser never computes final totals, never sees the Razorpay secret or the Supabase service key, and never writes orders directly. Every order re-reads prices from Postgres and runs through `lib/pricing.ts` inside a single transaction (`place_order` RPC).

---

## Quick start

### Prerequisites
- Node 20+
- A free [Supabase](https://supabase.com) project
- (Optional) Razorpay **test-mode** keys, OpenAI/OpenRouter key

### 1 · Database

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push          # applies supabase/migrations/*.sql
```

(Alternative: paste each file from `supabase/migrations/` into the Supabase SQL Editor, in filename order.)

### 2 · Environment

```bash
cp .env.sample .env           # then fill in values — see the table in .env.sample
```

Minimum for the full customer flow: the three Supabase keys, `SESSION_SECRET` (`openssl rand -base64 32`), and `OTP_MOCK=true`. Razorpay/AI keys are only needed for card/UPI payments and the AI banner respectively — everything else works without them.

### 3 · Seed & run

```bash
npm install
npm run seed:menu             # parses supabase/seed/menu/*.txt → menu_items
npm run seed:admin            # creates the admin user from ADMIN_EMAIL/PASSWORD
npm run dev                   # http://localhost:3000
```

### 4 · Try it
1. **Sign in** with any 10-digit Indian mobile number (starts 6–9) → OTP `123456`.
2. Build a pizza → cart → checkout → **Cash on Delivery** (no Razorpay needed).
3. Card/UPI (test mode): card `4111 1111 1111 1111`, any future expiry/CVV — or UPI `success@razorpay`.
4. Admin: `/admin/login` with your seeded credentials.

> **Geofence tip:** the shop is pinned at New Ashok Nagar, Delhi (28.5905, 77.3037) with a 4 km radius. Testing from elsewhere? Update it live:
> `update settings set shop_lat = <lat>, shop_lng = <lng>;`

---

## Testing

```bash
npm test            # 73 Vitest unit tests: pricing parity, validators, geo,
                    # money rounding, cart, admin utils, AI validation
npm run lint        # ESLint
npm run build       # production build (also type-checks)
```

The pricing tests assert **bit-for-bit parity** with the Stage 2 Python engine, including banker's rounding (`ROUND_HALF_EVEN`) on integer paise.

## Deployment (Vercel)

1. Push this repo to GitHub → import it at [vercel.com](https://vercel.com) (Next.js auto-detected).
2. Add every variable from your `.env` under **Project → Settings → Environment Variables**.
3. Deploy → `https://<app>.vercel.app`.
4. **Razorpay webhook** (async payment source of truth): Dashboard → Settings → Webhooks → add
   `https://<app>.vercel.app/api/webhooks/razorpay`, subscribe to `payment.captured` + `payment.failed`, and set the signing secret as `RAZORPAY_WEBHOOK_SECRET` in Vercel.

**Live-modify demo** (no redeploy — business params live in the `settings` table):

```sql
update settings set discount_threshold = 3;   -- next 3-pizza order gets the discount
```

---

## AI recommendation engine

**Route:** `POST /api/ai/recommend` (server-only — the API key never reaches the browser).

**Model:** `gpt-4o-mini` via OpenAI, or `openai/gpt-4o-mini` via OpenRouter (`AI_PROVIDER=openrouter`). Chosen because the call sits on the critical path before the menu renders: it's fast, cheap, and the output is a tiny JSON object (`max_tokens: 200`). The same OpenAI SDK talks to both providers — only `baseURL`, key, and model id change.

**System prompt** (verbatim from [`lib/ai/recommend.ts`](lib/ai/recommend.ts)):

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

**Guardrails:** `response_format: json_object`; every suggestion is validated against real `menu_items` names (hallucinated items → rejected); any failure (missing key, API error, invalid JSON, invented item) falls back to a **deterministic popularity pick**, so the banner never blocks or breaks the page. Each response is cached in the `ai_recommendations` table (per customer/day) with the exact prompt for auditability.

## Pricing rules (Stage 2 parity)

```
unit      = base + pizza + Σ toppings          (integer paise — no floats)
line      = unit × qty
subtotal  = Σ line
discount  = discount_pct% of subtotal      iff total qty ≥ discount_threshold
gst       = gst_pct% of (subtotal − discount)
total     = subtotal − discount + gst
```

All parameters (`discount_threshold`, `discount_pct`, `gst_pct`, delivery radius, topping/pizza caps) live in the single-row `settings` table — changeable live from SQL with no redeploy.

## Product imagery

Menu photos are curated Unsplash images mapped by keyword in [`lib/pizza-images.ts`](lib/pizza-images.ts) — every URL was visually verified so the photo matches the name (paneer names show paneer, chicken shows chicken pieces, crust options show that crust). Unknown names get a stable hash-picked photo from the pool. If any image fails to load (offline demo), an illustrated SVG pizza renders instead — no broken images, ever. When a real `image_url` column is added to `menu_items`, pass it through the existing `imageUrl` prop to bypass the mapping.

## Project structure

```
app/
├─ (customer)/        # menu, login, cart, checkout, order/[code]
├─ admin/             # login + (dash)/ dashboard, kitchen
└─ api/               # auth/otp, cart/price, orders, payments, ai, webhooks
components/           # menu browser, builder sheet, cart bar, kitchen board…
lib/
├─ pricing.ts         # authoritative money math (Stage 2 parity)
├─ validators.ts      # input validation (client UX + server truth)
├─ geo.ts             # Haversine geofence
├─ pizza-images.ts    # verified photo map (pizzas + bases)
├─ ai/recommend.ts    # LLM call + validation + fallback
└─ supabase/          # server (service-role) + browser (anon) clients
supabase/
├─ migrations/        # schema, RLS, place_order RPC, analytics
└─ seed/              # menu .txt files + seed scripts
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server at `localhost:3000` |
| `npm run build` / `start` | Production build / serve |
| `npm test` | Vitest unit suite |
| `npm run lint` | ESLint |
| `npm run seed:menu` | Upsert menu from `supabase/seed/menu/*.txt` |
| `npm run seed:admin` | Create the admin auth user |
