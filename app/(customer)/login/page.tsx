"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [hint, setHint] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function requestOtp() {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/otp/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!data.ok) return setError(data.error);
      setHint(data.hint ?? "");
      setStep("code");
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp() {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone, code, name }),
      });
      const data = await res.json();
      if (!data.ok) return setError(data.error);
      router.push("/");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm py-8">
      <h1 className="mb-1 text-2xl font-extrabold">Sign in</h1>
      <p className="mb-6 text-sm text-muted">Order with your phone number — name is optional.</p>

      {step === "phone" ? (
        <div className="space-y-3">
          <input
            inputMode="numeric"
            placeholder="10-digit mobile number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface px-4 py-3"
          />
          <input
            placeholder="Name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface px-4 py-3"
          />
          <button
            onClick={requestOtp}
            disabled={busy}
            className="w-full rounded-xl bg-brand px-4 py-3 font-bold text-white hover:bg-brand-dark disabled:opacity-50"
          >
            {busy ? "Sending…" : "Send code"}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {hint && <p className="rounded-lg bg-orange-50 px-3 py-2 text-sm text-brand">{hint}</p>}
          <input
            inputMode="numeric"
            placeholder="Enter OTP"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 tracking-widest"
          />
          <button
            onClick={verifyOtp}
            disabled={busy}
            className="w-full rounded-xl bg-brand px-4 py-3 font-bold text-white hover:bg-brand-dark disabled:opacity-50"
          >
            {busy ? "Verifying…" : "Verify & continue"}
          </button>
          <button onClick={() => setStep("phone")} className="w-full text-sm text-muted">
            ← Change number
          </button>
        </div>
      )}

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
