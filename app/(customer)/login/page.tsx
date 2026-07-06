"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { PizzaMark } from "@/components/pizza-art";
import { scaleTap } from "@/lib/motion";
import { validatePhone } from "@/lib/validators";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [existing, setExisting] = useState(false); // does this phone already have an account?
  const [hint, setHint] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // Where to go after signing in — e.g. /login?next=/checkout returns to the flow.
  const [next, setNext] = useState("/");

  useEffect(() => {
    const n = new URLSearchParams(window.location.search).get("next");
    if (n && n.startsWith("/") && !n.startsWith("//")) setNext(n);
  }, []);

  async function requestOtp() {
    setError("");
    // Same validator the server uses — normalizes +91 / spaces and checks format
    // for instant feedback before we hit the API.
    const p = validatePhone(phone);
    if (!p.ok) return setError(p.error);
    setPhone(p.value); // reflect the normalized 10-digit number back to the user
    setBusy(true);
    try {
      const res = await fetch("/api/auth/otp/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: p.value }),
      });
      const data = await res.json();
      if (!data.ok) return setError(data.error);
      setExisting(Boolean(data.existing));
      setHint(data.hint ?? "");
      setStep("code");
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp() {
    setError("");
    if (!existing && !name.trim()) return setError("Please enter your name.");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone, code, name: existing ? undefined : name }),
      });
      const data = await res.json();
      if (!data.ok) return setError(data.error);
      router.push(next);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const heading = step === "phone" ? "Sign in" : existing ? "Welcome back 👋" : "Sign up";
  const subtitle =
    step === "phone"
      ? "Enter your phone — we'll text a code, no password needed."
      : existing
        ? "Enter the 6-digit code to sign in."
        : "You're new here! Add your name + the code to create your account.";

  return (
    <div className="mx-auto max-w-sm py-8">
      <div className="mb-6 flex flex-col items-center text-center">
        <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-gradient shadow-warm-md">
          <PizzaMark size={30} />
        </span>
        <h1 className="text-2xl font-extrabold">{heading}</h1>
        <p className="mt-1 text-sm text-muted">{subtitle}</p>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5 shadow-warm-sm">
        <AnimatePresence mode="wait">
          {step === "phone" ? (
            <motion.div
              key="phone"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.22 }}
              className="space-y-3"
            >
              <input
                inputMode="numeric"
                placeholder="10-digit mobile number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && requestOtp()}
                className="w-full rounded-xl border border-border bg-surface px-4 py-3 focus:border-brand focus:outline-none"
              />
              <motion.button
                whileTap={busy ? undefined : scaleTap.whileTap}
                onClick={requestOtp}
                disabled={busy}
                className="w-full rounded-xl bg-brand-gradient px-4 py-3 font-bold text-white shadow-warm-md disabled:opacity-50"
              >
                {busy ? "Checking…" : "Continue"}
              </motion.button>
            </motion.div>
          ) : (
            <motion.div
              key="code"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.22 }}
              className="space-y-4"
            >
              {!existing && (
                <input
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface px-4 py-3 focus:border-brand focus:outline-none"
                />
              )}
              {hint && <p className="rounded-lg bg-orange-50 px-3 py-2 text-center text-sm text-brand">{hint}</p>}
              <OtpInput value={code} onChange={setCode} />
              <motion.button
                whileTap={busy ? undefined : scaleTap.whileTap}
                onClick={verifyOtp}
                disabled={busy}
                className="w-full rounded-xl bg-brand-gradient px-4 py-3 font-bold text-white shadow-warm-md disabled:opacity-50"
              >
                {busy ? "Verifying…" : existing ? "Sign in" : "Create account"}
              </motion.button>
              <button onClick={() => { setStep("phone"); setCode(""); }} className="w-full text-sm text-muted">
                ← Change number
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function OtpInput({ value, onChange, length = 6 }: { value: string; onChange: (v: string) => void; length?: number }) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  function setDigit(i: number, raw: string) {
    const digit = raw.replace(/\D/g, "").slice(-1);
    const chars = value.padEnd(length, " ").split("");
    chars[i] = digit || " ";
    const next = chars.join("").replace(/\s+$/, "");
    onChange(next);
    if (digit && i < length - 1) refs.current[i + 1]?.focus();
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !value[i] && i > 0) refs.current[i - 1]?.focus();
  }

  function handlePaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (text) {
      onChange(text);
      e.preventDefault();
    }
  }

  return (
    <div className="flex justify-center gap-2" onPaste={handlePaste}>
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          inputMode="numeric"
          maxLength={1}
          value={value[i] ?? ""}
          onChange={(e) => setDigit(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className="h-12 w-10 rounded-xl border border-border bg-surface text-center text-lg font-bold tracking-widest focus:border-brand focus:outline-none"
        />
      ))}
    </div>
  );
}
