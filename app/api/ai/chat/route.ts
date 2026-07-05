import { NextResponse } from "next/server";
import { getMenu } from "@/lib/data/menu";
import { getTopPicks } from "@/lib/data/signals";
import { getSettings } from "@/lib/data/settings";
import { getChatReply, type ChatMessage } from "@/lib/ai/chat";

// Conversational ordering assistant. Stateless: the client sends the running
// transcript each turn. Guardrails: bounded transcript, bounded message length,
// menu-validated proposals (in getChatReply). No auth needed — it only reads the
// menu and returns a cart proposal the user must confirm.
const MAX_MESSAGES = 24;
const MAX_LEN = 600;

function sanitize(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m): m is { role: unknown; content: unknown } => !!m && typeof m === "object")
    .map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: typeof m.content === "string" ? m.content.slice(0, MAX_LEN) : "",
    }))
    .filter((m): m is ChatMessage => m.content.length > 0)
    .slice(-MAX_MESSAGES);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const messages = sanitize(body?.messages);
  if (messages.length === 0) {
    return NextResponse.json({ error: "No message." }, { status: 400 });
  }

  let menu, topPicks, settings;
  try {
    [menu, topPicks, settings] = await Promise.all([getMenu(), getTopPicks(3), getSettings()]);
  } catch {
    return NextResponse.json(
      { message: "Sorry, the kitchen's busy right now — please browse the menu. 🍕", quickReplies: null, proposal: null },
      { status: 200 },
    );
  }

  const reply = await getChatReply({
    messages,
    menu,
    topPicks,
    limits: { maxToppings: settings.max_toppings, maxPizzas: settings.max_pizzas },
  });

  return NextResponse.json(reply);
}
