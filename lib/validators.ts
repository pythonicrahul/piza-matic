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

/**
 * Name is OPTIONAL in Stage 3 (per product decision). Empty → accepted as "".
 * A non-empty value must still satisfy the Stage 2 name rule.
 */
export function validateName(raw: string | null | undefined): Result<string> {
  const name = (raw ?? "").trim();
  if (name === "") return ok(""); // optional
  if (!NAME_RE.test(name)) {
    return err("Please enter a valid name using letters and spaces only (2–40 characters).");
  }
  return ok(name);
}

export function validatePhone(raw: string | null | undefined): Result<string> {
  const phone = (raw ?? "").trim();
  if (phone === "") {
    return err("Phone number cannot be empty. Enter a 10-digit number starting with 6, 7, 8, or 9.");
  }
  if (!PHONE_RE.test(phone)) {
    return err("Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.");
  }
  return ok(phone);
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
