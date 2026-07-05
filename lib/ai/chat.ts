import "server-only";

// Conversational ordering assistant ("Sage") — brief AI Feature B.
//
// A guest chats about their mood/craving; the assistant asks a couple of short
// questions, then PROPOSES one concrete pizza built ONLY from the live menu.
// The proposal is validated server-side (names → real menu items) before it ever
// reaches the client, so the model cannot invent items, prices, or toppings.
//
// Guardrails are layered (defense in depth):
//   1. Prompt  — role, tone, intent handling, hard rules, strict JSON schema.
//   2. Schema  — response_format: json_object + strict parsing.
//   3. Validate — resolveProposal() drops non-menu / unavailable items, caps
//                 toppings & quantity, de-dupes. A bad pizza/base ⇒ no card.
//   4. Fallback — any failure returns a safe, on-brand message (chat never breaks).
//   5. Money   — the assistant only fills the cart; payment stays in checkout.

import OpenAI from "openai";
import { providerConfig } from "@/lib/ai/recommend";
import type { Menu } from "@/lib/data/menu";
import type { TopPick } from "@/lib/data/signals";
import type { CartItemRef } from "@/lib/cart-types";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatLimits {
  maxToppings: number;
  maxPizzas: number;
}

/** A proposal after server validation — items are real menu refs, ready to add. */
export interface ResolvedProposal {
  pizza: CartItemRef;
  base: CartItemRef;
  toppings: CartItemRef[];
  qty: number;
  why: string;
  unit_paise: number;
}

export interface ChatReply {
  message: string;
  quickReplies: string[] | null;
  proposal: ResolvedProposal | null;
}

export interface ChatInput {
  messages: ChatMessage[];
  menu: Menu;
  topPicks: TopPick[];
  limits: ChatLimits;
}

// ── System prompt ──────────────────────────────────────────────────────────
// The static behavioural contract. Live MENU + TOP PICKS are appended per call.
const PERSONA = `You are "Sage", SliceMatic's warm in-app pizza ordering assistant for a single outlet in Delhi. Your one job: through a short, friendly chat, help the guest pick a pizza they'll love and hand it to their cart. You're cheerful, concise, and never pushy.`;

const RULES = `── HOW YOU TALK ──
- Keep every reply to 1–2 short sentences. Ask ONE thing at a time.
- Warm and human; at most 1–2 emoji. Never robotic, never salesy.
- Whenever you ask a question, ALSO offer 2–4 short tappable "quickReplies".
- Ask AT MOST 2–3 questions before you propose. When unsure, propose something.

── READING THE GUEST ──
- Just a greeting ("hi","hey"): greet warmly, ask how they're feeling / what they're craving, and mention TODAY'S TOP PICK. quickReplies like ["🌱 Veg","🍗 Non-veg","✨ Surprise me"].
- Vague ("order a pizza","I'm hungry"): first ask Veg or Non-veg, then one taste question (e.g. spicy vs cheesy), then propose.
- A mood/preference ("veg, something healthy & filling"): ask ONE narrowing question if helpful, then propose.
- Defers to you ("your best","surprise me","you choose","recommend"): DON'T interrogate — propose a TOP PICK immediately with a one-line why.
- Specific ("Margherita, extra cheese"): make it fit the menu and propose it.
- Off-topic: gently, briefly steer back to pizza.

── BUILDING THE PROPOSAL ──
When ready, return a "proposal": exactly ONE pizza + ONE base + 0–{MAXTOPPINGS} toppings + a quantity (1–{MAXPIZZAS}).
- Use ONLY the exact item names in the MENU below. NEVER invent items, sizes, prices, or toppings.
- If the guest said VEG, every item MUST be veg. If non-veg, either is fine.
- Match the vibe: "cheesy" → cheesy base/toppings, "spicy" → spicy toppings, "healthy/light" → veggies, "filling/loaded" → a hearty base + a couple toppings.
- When the guest defers or has no strong preference, prefer the data-backed TOP PICKS.
- "why": ≤ 12 words, friendly, tied to what they said.
- After a proposal keep chatting — they may tweak it or want another; just send a fresh proposal.

── HARD RULES ──
- Output STRICT JSON ONLY, matching the schema. No text outside the JSON.
- Never mention discounts, offers, delivery times, or any total — the cart shows the real price.
- No allergen or health guarantees beyond the veg/non-veg flags given.
- You only fill the cart; you never take payment or ask for personal/payment details.`;

const SCHEMA = `── OUTPUT SCHEMA ──
{
  "message": string,                 // your reply, 1–2 warm sentences
  "quickReplies": string[] | null,   // 2–4 short tappable options when you ask something; else null
  "proposal": {                      // ONLY when recommending a specific pizza; else null
    "pizza": string,                 // exact MENU pizza name
    "base": string,                  // exact MENU base name
    "toppings": string[],            // 0–{MAXTOPPINGS} exact MENU topping names
    "qty": number,                   // integer 1–{MAXPIZZAS}
    "why": string                    // ≤ 12 words
  } | null
}`;

function vegTag(is_veg: boolean | null | undefined) {
  return is_veg ? "veg" : "non-veg";
}

function menuBlock(menu: Menu): string {
  const bases = menu.base.map((b) => b.name).join(", ");
  const pizzas = menu.pizza.map((p) => `${p.name} [${vegTag(p.is_veg)}]`).join(", ");
  const toppings = menu.topping.map((t) => `${t.name} [${vegTag(t.is_veg)}]`).join(", ");
  return `── MENU (use these EXACT names) ──\nBases: ${bases}\nPizzas: ${pizzas}\nToppings: ${toppings}`;
}

function topPicksBlock(picks: TopPick[]): string {
  if (picks.length === 0) return "";
  const lines = picks.map((p, i) => {
    const t = p.toppings.length ? ` — loved with ${p.toppings.join(", ")}` : "";
    return `${i + 1}. ${p.pizza}${t}`;
  });
  return `── TODAY'S TOP PICKS (offer these when the guest defers) ──\n${lines.join("\n")}`;
}

export function buildSystemPrompt(menu: Menu, picks: TopPick[], limits: ChatLimits): string {
  return [PERSONA, RULES, SCHEMA, menuBlock(menu), topPicksBlock(picks)]
    .filter(Boolean)
    .join("\n\n")
    .replaceAll("{MAXTOPPINGS}", String(limits.maxToppings))
    .replaceAll("{MAXPIZZAS}", String(limits.maxPizzas));
}

// ── Proposal validation ─────────────────────────────────────────────────────
const ref = (i: { id: string; name: string; price_paise: number; is_veg?: boolean | null }): CartItemRef => ({
  id: i.id,
  name: i.name,
  price_paise: i.price_paise,
  is_veg: i.is_veg ?? null,
});

/**
 * Turn a raw LLM proposal (names) into real menu refs, or null if the pizza/base
 * aren't valid available menu items. Unknown/duplicate toppings are dropped,
 * toppings are capped, and qty is clamped to [1, maxPizzas]. `getMenu()` only
 * returns available items, so unavailable items are rejected for free.
 */
export function resolveProposal(
  parsed: unknown,
  menu: Menu,
  limits: ChatLimits,
): ResolvedProposal | null {
  if (!parsed || typeof parsed !== "object") return null;
  const p = parsed as { pizza?: unknown; base?: unknown; toppings?: unknown; qty?: unknown; why?: unknown };

  const byName = (list: Menu["pizza"], name: unknown) =>
    typeof name === "string" ? list.find((i) => i.name.toLowerCase() === name.trim().toLowerCase()) : undefined;

  const pizza = byName(menu.pizza, p.pizza);
  const base = byName(menu.base, p.base);
  if (!pizza || !base) return null;

  const toppings: CartItemRef[] = [];
  const seen = new Set<string>();
  for (const name of Array.isArray(p.toppings) ? p.toppings : []) {
    if (toppings.length >= limits.maxToppings) break;
    const t = byName(menu.topping, name);
    if (t && !seen.has(t.id)) {
      seen.add(t.id);
      toppings.push(ref(t));
    }
  }

  let qty = Math.round(Number(p.qty));
  if (!Number.isFinite(qty)) qty = 1;
  qty = Math.max(1, Math.min(limits.maxPizzas, qty));

  const pizzaRef = ref(pizza);
  const baseRef = ref(base);
  const unit_paise = baseRef.price_paise + pizzaRef.price_paise + toppings.reduce((s, t) => s + t.price_paise, 0);

  return {
    pizza: pizzaRef,
    base: baseRef,
    toppings,
    qty,
    why: typeof p.why === "string" ? p.why.slice(0, 120) : "",
    unit_paise,
  };
}

// ── LLM call ─────────────────────────────────────────────────────────────────
function safeString(s: unknown, fallback: string): string {
  return typeof s === "string" && s.trim() ? s.trim() : fallback;
}

function cleanQuickReplies(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const chips = v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.slice(0, 40)).slice(0, 4);
  return chips.length ? chips : null;
}

/** Deterministic degrade when there's no LLM key — still offers the house pick. */
function deterministicFallback(menu: Menu, picks: TopPick[], limits: ChatLimits): ChatReply {
  const pickName = picks[0]?.pizza ?? menu.pizza[0]?.name;
  const proposal =
    pickName != null
      ? resolveProposal(
          { pizza: pickName, base: menu.base[0]?.name, toppings: picks[0]?.toppings ?? [], qty: 1, why: "Our house favourite." },
          menu,
          limits,
        )
      : null;
  return {
    message: proposal ? "Our house favourite is always a great shout! 🍕" : "What are you craving today?",
    quickReplies: proposal ? null : ["🌱 Veg", "🍗 Non-veg", "✨ Surprise me"],
    proposal,
  };
}

const SORRY: ChatReply = {
  message: "Sorry, I didn't quite catch that — shall we start with veg or non-veg? 🍕",
  quickReplies: ["🌱 Veg", "🍗 Non-veg"],
  proposal: null,
};

export async function getChatReply(input: ChatInput): Promise<ChatReply> {
  const { messages, menu, topPicks, limits } = input;
  const cfg = providerConfig();
  if (!cfg.apiKey || cfg.apiKey.startsWith("sk-REPLACE")) {
    return deterministicFallback(menu, topPicks, limits);
  }

  const client = new OpenAI({ apiKey: cfg.apiKey, baseURL: cfg.baseURL });
  const system = buildSystemPrompt(menu, topPicks, limits);

  try {
    const completion = await client.chat.completions.create({
      model: cfg.model,
      max_tokens: 320,
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return SORRY;

    const parsed = JSON.parse(raw) as { message?: unknown; quickReplies?: unknown; proposal?: unknown };
    const proposal = parsed.proposal ? resolveProposal(parsed.proposal, menu, limits) : null;

    return {
      message: safeString(parsed.message, "Here's an idea for you 🍕"),
      quickReplies: cleanQuickReplies(parsed.quickReplies),
      proposal,
    };
  } catch {
    return SORRY;
  }
}
