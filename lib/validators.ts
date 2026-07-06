// Input validators — ported from the Stage 2 Python `validators.py`.
// Every validator returns a discriminated result and never throws, so callers
// can always handle the outcome. These run BOTH client-side (UX) and again
// server-side (source of truth).

export type Valid<T> = { ok: true; value: T };
export type Invalid = { ok: false; error: string };
export type Result<T> = Valid<T> | Invalid;

const ok = <T>(value: T): Valid<T> => ({ ok: true, value });
const err = (error: string): Invalid => ({ ok: false, error });

// letters + spaces, 2–40 chars
const NAME_RE = /^[A-Za-z][A-Za-z ]{1,39}$/;
// Indian mobile: 10 digits, starts 6–9
const PHONE_RE = /^[6-9][0-9]{9}$/;

/** Name is required: non-empty, letters + spaces, 2–40 chars. */
export function validateName(raw: string | null | undefined): Result<string> {
  const name = (raw ?? "").trim();
  if (name === "") {
    return err("Please enter your name.");
  }
  if (!NAME_RE.test(name)) {
    return err("Please enter a valid name using letters and spaces only (2–40 characters).");
  }
  return ok(name);
}

export function validatePhone(raw: string | null | undefined): Result<string> {
  const trimmed = (raw ?? "").trim();
  if (trimmed === "") {
    return err("Phone number cannot be empty. Enter a 10-digit number starting with 6, 7, 8, or 9.");
  }
  // Normalize real-world formats: strip everything but digits, then drop a +91
  // country code or a leading 0 trunk prefix — so "+91 98765 43210",
  // "98765-43210" and "098765 43210" all resolve to the canonical 10 digits.
  let digits = trimmed.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (!PHONE_RE.test(digits)) {
    return err("Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.");
  }
  return ok(digits);
}

// A menu price is stored as integer paise. Cap at ₹1,00,000 as a sanity bound.
const MAX_PRICE_PAISE = 10_000_000;

/** A menu price in whole paise: an integer with 0 ≤ p ≤ ₹1,00,000. */
export function validatePricePaise(raw: unknown): Result<number> {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return err("Enter a valid price.");
  if (!Number.isInteger(n)) return err("Price must be a whole number of paise.");
  if (n < 0) return err("Price cannot be negative.");
  if (n > MAX_PRICE_PAISE) return err("That price looks too high.");
  return ok(n);
}

/**
 * Quantity for one pizza line. `maxAllowed` is dynamic: max_pizzas minus what is
 * already in the cart. Rejects floats, non-digits, zero, negatives, over-cap.
 */
export function validatePizzaQty(raw: string | number, maxAllowed: number): Result<number> {
  const s = String(raw ?? "").trim();
  if (s === "") return err(`Enter a quantity between 1 and ${maxAllowed}.`);
  if (!/^[0-9]+$/.test(s)) return err("Enter a whole number (no decimals or letters).");
  const n = parseInt(s, 10);
  if (n < 1) return err("Quantity must be at least 1.");
  if (n > maxAllowed) {
    return err(
      maxAllowed <= 1
        ? "Only 1 slot left in the cart (10 pizzas max per order)."
        : `You can add at most ${maxAllowed} more pizzas (cart limit is 10).`,
    );
  }
  return ok(n);
}

const PAYMENT_MODES: Record<string, "cash" | "card" | "upi"> = {
  "1": "cash",
  "2": "card",
  "3": "upi",
  cash: "cash",
  card: "card",
  upi: "upi",
};

export function validatePayment(raw: string | null | undefined): Result<"cash" | "card" | "upi"> {
  const s = (raw ?? "").trim().toLowerCase();
  if (s === "") return err("Please choose a payment mode: Cash, Card or UPI.");
  const mode = PAYMENT_MODES[s];
  if (!mode) return err("Invalid choice. Choose Cash, Card, or UPI.");
  return ok(mode);
}

/** Validate a topping selection (list of ids) against the per-line cap + no dupes. */
export function validateToppings(ids: string[], maxToppings: number): Result<string[]> {
  if (ids.length > maxToppings) {
    return err(`Maximum ${maxToppings} toppings per pizza.`);
  }
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) return err("Each topping can only appear once per pizza.");
    seen.add(id);
  }
  return ok(ids);
}
