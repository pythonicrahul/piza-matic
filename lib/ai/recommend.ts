import "server-only";

// AI Recommendation Engine (brief AI Feature A).
//
// Provider-agnostic: uses the OpenAI SDK, which also speaks to OpenRouter (an
// OpenAI-compatible gateway) by swapping baseURL + key + model. Develop with
// OpenAI; flip AI_PROVIDER=openrouter for the graded submission — same prompt,
// same behaviour. The SYSTEM_PROMPT below is the one to document in the README.

import OpenAI from "openai";

export interface HistoryEntry {
  pizza: string;
  base: string;
  toppings: string[];
}

export interface RecommendationInput {
  history: HistoryEntry[];
  menu: { bases: string[]; pizzas: string[]; toppings: string[] };
}

export interface Recommendation {
  pizza: string;
  base: string;
  topping: string | null;
  reason: string;
}

export interface RecommendationResult {
  rec: Recommendation;
  model: string;
  prompt: string; // exact user message sent (stored in ai_recommendations + README)
}

export const SYSTEM_PROMPT = `You are SliceMatic's menu concierge for a single pizza outlet in Delhi.
You are given a customer's past order history and the current menu.
Recommend exactly ONE combination: one pizza, one base, and one optional topping,
chosen ONLY from the provided menu lists. Prefer items similar to what the
customer ordered before; respect veg/non-veg preference inferred from history.
Return STRICT JSON: {"pizza": "...", "base": "...", "topping": "..."|null,
"reason": "<=15 words, friendly, references their history"}.
Do not invent items not in the menu. Do not add commentary outside the JSON.`;

/**
 * Validate a raw LLM suggestion against the menu — the model must not invent
 * items. Returns a clean Recommendation, or null if pizza/base aren't real menu
 * items (caller then falls back). An invalid/absent topping is dropped to null.
 */
export function validateRecommendation(
  parsed: Partial<Recommendation>,
  menu: RecommendationInput["menu"],
): Recommendation | null {
  const inMenu = (v: unknown, list: string[]) => typeof v === "string" && list.includes(v);
  if (!inMenu(parsed.pizza, menu.pizzas)) return null;
  if (!inMenu(parsed.base, menu.bases)) return null;
  const topping = parsed.topping && inMenu(parsed.topping, menu.toppings) ? parsed.topping : null;
  return {
    pizza: parsed.pizza as string,
    base: parsed.base as string,
    topping,
    reason: typeof parsed.reason === "string" ? parsed.reason : "A tasty pick for you.",
  };
}

function providerConfig() {
  if (process.env.AI_PROVIDER === "openrouter") {
    return {
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
      model: process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini",
    };
  }
  return {
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: undefined, // OpenAI default
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  };
}

/**
 * Ask the LLM for one recommendation. Returns null on any failure (missing key,
 * API error, unparseable output, or a suggestion that isn't in the menu) so the
 * caller can fall back to a deterministic popularity pick.
 */
export async function getRecommendation(
  input: RecommendationInput,
): Promise<RecommendationResult | null> {
  const cfg = providerConfig();
  if (!cfg.apiKey || cfg.apiKey.startsWith("sk-REPLACE")) return null;

  const client = new OpenAI({ apiKey: cfg.apiKey, baseURL: cfg.baseURL });
  const userMessage = JSON.stringify(input);

  try {
    const completion = await client.chat.completions.create({
      model: cfg.model,
      max_tokens: 200,
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Recommendation>;

    const rec = validateRecommendation(parsed, input.menu);
    if (!rec) return null;

    return { rec, model: cfg.model, prompt: userMessage };
  } catch {
    return null;
  }
}
