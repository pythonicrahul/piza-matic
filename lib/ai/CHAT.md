# "Order with Sage" — the conversational ordering feature

This document explains, end to end, how the chat-ordering assistant ("Sage")
works: every file involved, how data flows through them, the exact system prompt,
the layered guardrails, and how each edge case is handled. It's written for a
developer who is new to this codebase.

> **One-line summary:** the user chats about their mood → an LLM (OpenAI) proposes
> one pizza built **only** from our real menu → we validate that proposal on the
> server → the user taps "Add to cart" → it flows into the normal cart & checkout.
> The AI **never** touches money and **can't invent menu items**.

---

## 1. The big picture

```
BROWSER ── /chat  →  <ChatOrder> ──────────────────────────────────────────
   UI: message bubbles · quick-reply chips · proposal card · pinned input
          │
          │  POST /api/ai/chat   { messages }
          ▼
SERVER  ── app/api/ai/chat/route.ts ───────────────────────────────────────
   route.POST()   → sanitize(messages)
                  → load  getMenu() + getTopPicks() + getSettings()
   getChatReply() → buildSystemPrompt(menu, topPicks, limits)      [lib/ai/chat.ts]
                  → OpenAI chat.completions (JSON mode) ──────►  OpenAI (gpt-4o-mini)
                  → resolveProposal()  ← THE GUARDRAIL   ◄──────  menu (Postgres/Supabase)
          │
          │  { message, quickReplies, proposal }
          ▼
BROWSER ── render ─────────────────────────────────────────────────────────
   assistant bubble  +  <ProposalCard>
   tap "Add to cart" → useCart().add() → localStorage
                     → Cart → Checkout → Razorpay      (UNCHANGED)
```

The feature adds **5 new files** and lightly touches **4 existing ones**. Nothing
about pricing, cart, checkout, or payments changed — Sage just *fills the cart*.

| File | New? | Role |
|------|------|------|
| `lib/ai/chat.ts` | ✅ | **The brain.** System prompt + LLM call + proposal validation. |
| `lib/data/signals.ts` | ✅ | "Top picks" from real order data (grounds the small talk). |
| `app/api/ai/chat/route.ts` | ✅ | The HTTP endpoint the browser calls each turn. |
| `components/chat-order.tsx` | ✅ | The chat UI (bubbles, chips, proposal card, input). |
| `app/(customer)/chat/page.tsx` | ✅ | The `/chat` page that renders `<ChatOrder>`. |
| `lib/ai/recommend.ts` | edit | Exposes the shared `providerConfig()` (OpenAI/OpenRouter). |
| `components/tab-bar.tsx` | edit | Adds the `ChatIcon`. |
| `components/customer-tab-bar.tsx` | edit | Adds the **"Sage"** tab. |
| `components/cart-bar.tsx` | edit | Hides the floating cart bar on `/chat`. |

---

## 2. How a single turn flows (step by step)

Follow one message — the user types **"surprise me"**:

```
1. USER types "surprise me" and hits Enter.
       │
2. ChatOrder.send("surprise me")                        [components/chat-order.tsx]
       │   • appends {role:"user", content:"surprise me"} to `messages`
       │   • builds the API payload: every message EXCEPT the local greeting
       │       payload = messages.filter(m => !m.local).map(m => ({role, content}))
       ▼
3. fetch POST /api/ai/chat  { messages: [...] }
       │
4. route.POST()                                          [app/api/ai/chat/route.ts]
       │   • sanitize(): keep last 24 messages, clamp each to 600 chars,
       │                 force role to "user"|"assistant", drop empties
       │   • load in parallel: getMenu(), getTopPicks(3), getSettings()
       ▼
5. getChatReply({ messages, menu, topPicks, limits })   [lib/ai/chat.ts]
       │   • buildSystemPrompt(menu, topPicks, limits)  → the full instructions
       │   • client.chat.completions.create({ response_format: json_object, … })
       ▼
6. OpenAI returns a JSON STRING, e.g.
       { "message":"How about the Greek Mediterranean? 🍕",
         "quickReplies": null,
         "proposal": { "pizza":"Greek Mediterranean", "base":"Thin Crust",
                       "toppings":["Button Mushrooms","Sun-Dried Tomatoes"],
                       "qty":1, "why":"A fresh, tasty pick." } }
       ▼
7. resolveProposal(parsed.proposal, menu, limits)   ← THE GUARDRAIL  [lib/ai/chat.ts]
       │   • look up "Greek Mediterranean" in menu.pizza  → real item + id + price
       │   • look up "Thin Crust" in menu.base            → real item + id + price
       │   • look up each topping; drop unknowns; cap at maxToppings; de-dupe
       │   • clamp qty into [1, maxPizzas]
       │   • compute unit_paise = pizza + base + toppings
       │   → returns a ResolvedProposal made of REAL menu refs (or null if invalid)
       ▼
8. route returns JSON  { message, quickReplies, proposal:<resolved refs> }
       ▼
9. ChatOrder appends the assistant message + renders:
       • the text bubble
       • <ProposalCard> with the itemised price breakup + "Add to cart"
       ▼
10. USER taps "Add to cart"
       │   • useCart().add({ pizza, base, toppings, qty })   [cart-provider.tsx]
       │   • CartProvider saves to localStorage ("slicematic_cart_v1")
       │   • card flips to "Added ✅ · View cart"
       ▼
11. From here it's the EXISTING flow: Cart → Checkout → Razorpay. Sage is done.
```

**Key idea:** the LLM only ever returns *names*. The server turns those names into
**real menu objects (with ids and prices)** — and if a name isn't in the menu, the
proposal is thrown away. That's why Sage can't sell something we don't have.

---

## 3. The system prompt (the "brain's instructions")

A **system prompt** is the hidden instruction we send to the model *before* the
conversation. It defines who the assistant is and the rules it must follow. Ours
is assembled by `buildSystemPrompt()` from four static blocks plus two **live**
blocks (the current menu and today's top picks), so the model always reasons over
real data.

```
buildSystemPrompt(menu, picks, limits) =
    PERSONA          ← who Sage is, its one job, its tone
  + RULES            ← how to talk, how to read intent, how to build a proposal, HARD RULES
  + SCHEMA           ← the exact JSON shape it must output
  + menuBlock(menu)  ← LIVE: "Bases: … / Pizzas: X [veg] … / Toppings: Y [non-veg] …"
  + topPicksBlock()  ← LIVE: "1. Greek Mediterranean — loved with Button Mushrooms, …"
     (then {MAXTOPPINGS}/{MAXPIZZAS} placeholders are filled from settings)
```

### What each block does

**PERSONA** — "You are Sage, SliceMatic's warm in-app ordering assistant … your one
job is to help the guest pick a pizza and hand it to their cart." Sets role + tone
(cheerful, concise, never pushy).

**RULES** — the meat. It covers four things:

**1. How you talk** — 1–2 sentences, one question at a time, always offer 2–4 tappable
`quickReplies` when asking, and **ask at most 2–3 questions before proposing**.

**2. Reading the guest** (the intent matrix):

| Guest says… | Sage does… |
|---|---|
| "hi" (greeting) | greet, ask their mood, mention today's top pick, offer veg/non-veg/surprise chips |
| "order a pizza" (vague) | ask **Veg or Non-veg** first, then one taste question, then propose |
| "veg, healthy & filling" (mood) | one narrowing question if useful, then propose |
| "your best / surprise me" (**defer**) | **don't interrogate** — propose a top pick immediately |
| "Margherita, extra cheese" (specific) | make it fit the menu and propose it |
| anything off-topic | gently steer back to pizza |

**3. Building the proposal** — one pizza + one base + 0–`maxToppings` toppings + qty;
**use only exact menu names**; **if the guest said veg, every item must be veg**; match
the vibe (cheesy/spicy/healthy/filling); prefer the data-backed top picks when the
guest defers.

**4. Hard rules** — output **strict JSON only**; never mention discounts/offers/delivery
times/totals (the cart shows the real price); no allergen/health guarantees beyond the
veg flags; **never take payment or ask for personal/payment details**.

**SCHEMA** — the model is told to return exactly:

```jsonc
{
  "message": string,               // 1–2 warm sentences
  "quickReplies": string[] | null, // 2–4 tappable options when asking; else null
  "proposal": {                    // ONLY when recommending; else null
    "pizza": string, "base": string, "toppings": string[],
    "qty": number, "why": string
  } | null
}
```

**menuBlock / topPicksBlock** — injected fresh on every request. The menu carries
`[veg]`/`[non-veg]` tags so the model can honor veg requests, and the top picks come
from **real orders** (next section), so "our top pick is X" is true, not made up.

We also pass `response_format: { type: "json_object" }` to OpenAI ("JSON mode"), which
forces the reply to be parseable JSON — belt *and* suspenders with the SCHEMA instruction.

---

## 4. Grounding: where "today's top picks" come from

`lib/data/signals.ts → getTopPicks()` produces the specials Sage talks about, using
**the same ranking engine we already built for the cart upsell** — no new tables:

```
getTopPicks(limit):
  1. count order_items grouped by pizza_id          → pizza POPULARITY
  2. rank menu pizzas by that count (menu order as tie-break) → take top N
  3. for each top pizza, call cart_topping_suggestions(pizza) → its most co-ordered TOPPINGS
  → [{ pizza:"Greek Mediterranean", toppings:["Button Mushrooms","Sun-Dried Tomatoes"] }, …]
```

If there are **no orders yet** (fresh DB), step 1 is empty and it gracefully falls
back to menu order — so it always returns something sensible.

This is the "connect to the rest of the app" story: Sage reuses `getMenu()` (the
menu source of truth) and `cart_topping_suggestions` (the recommendation SQL), so it
stays consistent with the menu page and the cart upsell automatically.

---

## 5. The guardrails (defense in depth)

We assume the LLM **will** eventually misbehave (hallucinate an item, return prose
instead of JSON, suggest 10 toppings, ignore "veg"). So safety isn't one check — it's
**five layers**, each catching what the previous might miss. A bad LLM output gets
funneled down until only something safe survives:

```
        LLM raw output (untrusted!)
                 │
   ┌─────────────▼───────────────┐  Layer 1 — PROMPT
   │ rules + strict-JSON + veg   │  tells the model what's allowed
   └─────────────┬───────────────┘
                 │
   ┌─────────────▼───────────────┐  Layer 2 — SCHEMA (JSON mode)
   │ response_format json_object │  guarantees parseable JSON; JSON.parse in try/catch
   └─────────────┬───────────────┘
                 │
   ┌─────────────▼───────────────┐  Layer 3 — VALIDATION (the important one)
   │ resolveProposal():          │  names → REAL menu refs, or the whole proposal is dropped
   │  • pizza & base must exist  |  ← invalid pizza/base ⇒ return null ⇒ NO card shown
   │  • unknown toppings dropped │
   │  • toppings capped to max   │
   │  • qty clamped [1,maxPizzas]│
   │  • duplicate toppings delete│
   │  • only AVAILABLE items     │  (getMenu returns is_available=true only)
   └─────────────┬───────────────┘
                 │
   ┌─────────────▼───────────────┐  Layer 4 — ROUTE limits
   │ sanitize(): ≤24 msgs,       │  bounds context size & abuse
   │ ≤600 chars each, valid roles│
   └─────────────┬───────────────┘
                 │
   ┌─────────────▼───────────────┐  Layer 5 — MONEY boundary + confirm
   │ proposal only FILLS the cart₹│  no payment surface; user must tap "Add to cart"
   └─────────────┬───────────────┘
                 ▼
        safe { message, quickReplies, proposal }
```

Why each matters, in plain terms:

1. **Prompt** — first line of defense; most of the time the model just follows it.
2. **JSON mode** — without it a chatty model might reply with prose we can't parse.
   We still wrap `JSON.parse` in `try/catch` in case it returns junk.
3. **Validation (`resolveProposal`)** — the one you must never remove. Even a perfectly
   formatted proposal is untrusted until every item is matched against the live menu.
   Names are matched **case-insensitively and trimmed**, so "margherita" or " Cheese
   Burst " still resolve. A fake pizza/base ⇒ `null` ⇒ we show the chat message with
   **no card**, so the user never sees a broken/impossible option.
4. **Route limits** — a runaway or malicious client can't send a 10 MB transcript;
   we keep only the last 24 messages, 600 chars each.
5. **Money boundary** — Sage has *no* ability to charge. It returns a proposal; a human
   taps "Add to cart"; payment stays in the existing Razorpay checkout. So the worst
   an LLM bug can do is put a wrong (but real) pizza in the cart, which the user sees
   and can remove.

> **Note on the veg guarantee.** "Veg only" is enforced by the *prompt* (the menu we
> send is tagged `[veg]`/`[non-veg]`, and the rules say honor it). The server doesn't
> re-derive the user's veg preference (that lives in the free-form chat), so this one
> is prompt-enforced rather than code-enforced. In practice it holds reliably; if we
> ever wanted it code-enforced, we'd have the model echo a `veg_only` flag and reject
> non-veg items when it's set.

---

## 6. Edge cases and how they're handled

| Edge case | What happens |
|---|---|
| **LLM invents a pizza/base** ("Truffle Supreme") | `resolveProposal` can't find it → returns `null` → we send the message with **no proposal card**. Nothing broken shown. |
| **LLM invents a topping** | that one topping is dropped; the valid ones stay. |
| **Too many toppings** (model returns 6, cap is 5) | capped to `maxToppings` (from settings). |
| **Duplicate toppings** | de-duped by id. |
| **Crazy quantity** (`qty: 99` or `0` or `"lots"`) | clamped to `[1, maxPizzas]`; non-numeric → `1`. |
| **Model returns prose, not JSON** | `JSON.parse` throws → caught → we return the friendly `SORRY` reply. |
| **Model returns empty / missing `message`** | `safeString()` substitutes a friendly default. |
| **`quickReplies` malformed** | `cleanQuickReplies()` keeps only non-empty strings, ≤40 chars each, max 4; else `null`. |
| **No OpenAI API key configured** | `getChatReply` returns `deterministicFallback()` — still proposes the house top pick, so the feature degrades gracefully instead of erroring. |
| **OpenAI is down / times out** | `try/catch` → `SORRY` reply; the chat keeps working. |
| **DB read fails** (menu/settings) | the route returns a soft "kitchen's busy, browse the menu" message (HTTP 200), never a 500 in the UI. |
| **Empty transcript** | route returns 400 "No message." |
| **User on `http://<LAN-IP>` (phone)** | unrelated to chat, but note the cart key uses `uid()` (not `crypto.randomUUID`) which works in non-secure contexts. |
| **Fresh DB, no orders** | `getTopPicks` falls back to menu order → Sage still has a "top pick". |
| **User keeps chatting after a proposal** | fine — each turn can return a fresh proposal; the client renders a new card. |
| **Double-tap "Add to cart"** | after adding, the card swaps the button for "Added ✅ · View cart", so it can't be added twice from the same card. |
| **Off-topic message** ("what's the weather?") | prompt tells Sage to briefly steer back to pizza. |

---

## 7. How it connects to the rest of the app

```
 getMenu()  ────────────────►  Sage's menu context  (same source as the menu page)
 cart_topping_suggestions ──►  getTopPicks()         (same engine as the cart upsell)
 getSettings() ────────────►  maxToppings / maxPizzas caps (same limits as checkout)
 CartItemRef / CartLineUI ──►  proposal shape == cart line shape (drop-in add)
 useCart().add() ──────────►  localStorage cart      (same cart the whole app uses)
 providerConfig() ─────────►  OpenAI/OpenRouter       (shared with the recommender)
```

Because the proposal is shaped as `{ pizza, base, toppings, qty }` using the same
`CartItemRef` type the cart already uses, `useCart().add(proposal)` "just works" —
Sage doesn't need any special cart code. And since it stops at the cart, **checkout,
pricing, discounts, GST, geofencing, and Razorpay are all untouched**: the server
still re-prices everything at `/api/cart/price` and checkout, so even a wrong AI
suggestion can never produce a wrong bill.

**Navigation:** the `/chat` page lives inside the `(customer)` route group, so it
inherits the `CartProvider` (needed for `add`) and the bottom tab bar. We added a
**"Sage"** tab (with `ChatIcon`) between Menu and Cart, and hid the floating cart bar
on `/chat` so it doesn't collide with the pinned chat input.

---

## 8. Configuration

Environment variables (already used by the recommender — Sage reuses `providerConfig`):

| Var | Meaning |
|---|---|
| `AI_PROVIDER` | `openai` (default) or `openrouter` |
| `OPENAI_API_KEY` / `OPENROUTER_API_KEY` | the key |
| `OPENAI_MODEL` / `OPENROUTER_MODEL` | defaults to `gpt-4o-mini` / `openai/gpt-4o-mini` |

Model call settings (`getChatReply`): `temperature: 0.7`, `max_tokens: 320`,
`response_format: json_object`. gpt-4o-mini + a small menu context ≈ a few ₹ paise
per conversation and ~1–2 s per turn.

---

## 9. How to test / extend it

- **Unit tests:** `lib/ai/chat.test.ts` covers `resolveProposal` (the critical
  guardrail) — valid resolve, unknown pizza/base rejection, topping drop/cap/de-dupe,
  qty clamping, case-insensitive matching, junk input. Run `npx vitest run`.
- **Manual API test:** `curl -s localhost:3000/api/ai/chat -X POST -H 'content-type:
  application/json' -d '{"messages":[{"role":"user","content":"give me your best pizza"}]}'`
- **Extending the persona/rules:** edit the `PERSONA` / `RULES` / `SCHEMA` constants in
  `lib/ai/chat.ts`. Keep the JSON schema and `resolveProposal` in sync if you add
  fields to the proposal.
- **Adding a new "vibe":** you usually don't need code — the model infers vibes from
  menu item names. Only add DB metadata if names are ambiguous.

---

## 10. Mental model to remember

> The LLM is a **creative but untrusted intern**. We give it a clear job description
> (the system prompt), a fixed form to fill out (the JSON schema), and then a
> **strict reviewer** (`resolveProposal`) checks its work against the real menu before
> anything reaches the customer — and it's **never allowed near the cash register**
> (payment stays in checkout). That combination is what makes an AI ordering feature
> safe to ship.
