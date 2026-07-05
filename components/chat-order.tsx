"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useCart } from "./cart-provider";
import { VegDot } from "./veg-dot";
import { formatRupees } from "@/lib/money";
import { scaleTap } from "@/lib/motion";
import type { CartItemRef } from "@/lib/cart-types";

interface ChatProposal {
  pizza: CartItemRef;
  base: CartItemRef;
  toppings: CartItemRef[];
  qty: number;
  why: string;
  unit_paise: number;
}

interface Msg {
  role: "user" | "assistant";
  content: string;
  quickReplies?: string[] | null;
  proposal?: ChatProposal | null;
  local?: boolean; // greeting etc. — not sent back to the model
  added?: boolean;
}

export function ChatOrder({ topPick }: { topPick: string | null }) {
  const { add } = useCart();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Instant, LLM-free opener grounded in the real top pick.
  useEffect(() => {
    setMessages([
      {
        role: "assistant",
        local: true,
        content: topPick
          ? `Hey! 👋 I'm Sage, your pizza buddy. How are you feeling today — what are you craving? Our top pick right now is the ${topPick} 🍕`
          : "Hey! 👋 I'm Sage, your pizza buddy. How are you feeling — what are you craving today?",
        quickReplies: ["🌱 Veg", "🍗 Non-veg", "✨ Surprise me"],
      },
    ]);
  }, [topPick]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || busy) return;
    setInput("");
    const userMsg: Msg = { role: "user", content: clean };
    const next = [...messages, userMsg];
    setMessages(next);
    setBusy(true);
    try {
      const payload = next.filter((m) => !m.local).map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: payload }),
      });
      const reply = await res.json();
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: reply.message ?? "Here's an idea for you 🍕",
          quickReplies: reply.quickReplies ?? null,
          proposal: reply.proposal ?? null,
        },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Hmm, I lost that one — mind saying it again? 🍕", quickReplies: null },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function addToCart(idx: number, p: ChatProposal) {
    add({ pizza: p.pizza, base: p.base, toppings: p.toppings, qty: p.qty });
    setMessages((m) => m.map((msg, i) => (i === idx ? { ...msg, added: true } : msg)));
  }

  return (
    <div className="flex min-h-[calc(100dvh-13rem)] flex-col">
      <div className="flex-1 space-y-3">
        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
            >
              <div className="max-w-[85%] space-y-2">
                <div
                  className={
                    m.role === "user"
                      ? "rounded-2xl rounded-br-md bg-brand-gradient px-4 py-2.5 text-white shadow-warm-sm"
                      : "rounded-2xl rounded-bl-md border border-border bg-surface px-4 py-2.5 shadow-warm-sm"
                  }
                >
                  {m.content}
                </div>

                {m.proposal && (
                  <ProposalCard proposal={m.proposal} added={!!m.added} onAdd={() => addToCart(i, m.proposal!)} />
                )}

                {m.role === "assistant" && m.quickReplies && m.quickReplies.length > 0 && !busy && i === messages.length - 1 && (
                  <div className="flex flex-wrap gap-2">
                    {m.quickReplies.map((q) => (
                      <motion.button
                        key={q}
                        whileTap={scaleTap.whileTap}
                        onClick={() => send(q)}
                        className="rounded-full border border-brand/40 bg-brand/5 px-3 py-1.5 text-sm font-medium text-brand hover:bg-brand/10"
                      >
                        {q}
                      </motion.button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {busy && (
          <div className="flex justify-start">
            <div className="flex gap-1 rounded-2xl rounded-bl-md border border-border bg-surface px-4 py-3 shadow-warm-sm">
              {[0, 1, 2].map((d) => (
                <motion.span
                  key={d}
                  className="h-2 w-2 rounded-full bg-muted"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity, delay: d * 0.2 }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input pinned above the tab bar */}
      <div
        className="sticky z-10 -mx-4 mt-3 border-t border-border bg-background/90 px-4 py-3 backdrop-blur-lg"
        style={{ bottom: "calc(3.75rem + env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send(input)}
            placeholder="Tell me your mood or craving…"
            className="flex-1 rounded-full border border-border bg-surface px-4 py-2.5 focus:border-brand focus:outline-none"
          />
          <motion.button
            whileTap={scaleTap.whileTap}
            onClick={() => send(input)}
            disabled={busy || !input.trim()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-white shadow-warm-md disabled:opacity-40"
            aria-label="Send"
          >
            ↑
          </motion.button>
        </div>
      </div>
    </div>
  );
}

function ProposalCard({ proposal: p, added, onAdd }: { proposal: ChatProposal; added: boolean; onAdd: () => void }) {
  return (
    <div className="rounded-2xl border border-brand/30 bg-surface p-4 shadow-warm-sm">
      <div className="flex items-center gap-2 font-bold">
        <VegDot isVeg={p.pizza.is_veg ?? false} />
        {p.pizza.name}
      </div>
      {p.why && <p className="mt-0.5 text-sm text-muted">{p.why}</p>}

      <div className="mt-3 space-y-0.5 text-xs text-muted">
        <div className="flex justify-between gap-2">
          <span className="truncate">{p.pizza.name}</span>
          <span className="shrink-0">{formatRupees(p.pizza.price_paise)}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="truncate">{p.base.name} base</span>
          <span className="shrink-0">{formatRupees(p.base.price_paise)}</span>
        </div>
        {p.toppings.map((t) => (
          <div key={t.id} className="flex justify-between gap-2">
            <span className="truncate">+ {t.name}</span>
            <span className="shrink-0">{formatRupees(t.price_paise)}</span>
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between border-t border-border pt-1 text-sm font-semibold">
        <span>{p.qty > 1 ? `${p.qty} × per pizza` : "Per pizza"}</span>
        <span>{formatRupees(p.unit_paise)}</span>
      </div>

      {added ? (
        <div className="mt-3 flex items-center justify-between rounded-xl bg-green-50 px-4 py-2.5 text-sm font-semibold text-green-700">
          <span>Added to cart ✅</span>
          <Link href="/cart" className="text-brand hover:underline">
            View cart →
          </Link>
        </div>
      ) : (
        <motion.button
          whileTap={scaleTap.whileTap}
          onClick={onAdd}
          className="mt-3 w-full rounded-xl bg-brand-gradient px-4 py-2.5 font-bold text-white shadow-warm-md"
        >
          + Add to cart · {formatRupees(p.unit_paise * p.qty)}
        </motion.button>
      )}
    </div>
  );
}
