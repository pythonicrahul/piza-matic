// Integer-paise money helpers. Mirrors the Stage 2 Python engine which used
// Decimal with ROUND_HALF_EVEN (banker's rounding). All arithmetic here stays
// in integers/bigint so results are bit-for-bit reproducible and float-free.

/**
 * Banker's-rounded integer division: round(numerator / denom) with ties going
 * to the nearest EVEN integer. Uses bigint to avoid floating-point drift on the
 * exact-half case. Equivalent to Python's Decimal.quantize(ROUND_HALF_EVEN).
 */
export function divRoundHalfEven(numerator: bigint, denom: bigint): bigint {
  if (denom <= 0n) throw new Error("denom must be positive");
  const q = numerator / denom;
  const r = numerator % denom;
  const twice = r * 2n;
  if (twice < denom) return q;
  if (twice > denom) return q + 1n;
  // exact half → round to even
  return q % 2n === 0n ? q : q + 1n;
}

/**
 * Apply a percentage (e.g. 10.00, 18.00) to an integer-paise amount, returning
 * integer paise with banker's rounding. `pct` may carry up to 2 decimals.
 */
export function pctOfPaise(amountPaise: number, pct: number): number {
  const pctScaled = BigInt(Math.round(pct * 100)); // 18.00 -> 1800
  const numerator = BigInt(amountPaise) * pctScaled;
  const denom = 10000n; // /100 for pct, /100 for the 2-decimal scaling
  return Number(divRoundHalfEven(numerator, denom));
}

/** ₹ formatting for display, e.g. 359487 -> "₹3,594.87". */
export function formatRupees(paise: number): string {
  const neg = paise < 0;
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const p = String(abs % 100).padStart(2, "0");
  const grouped = rupees.toLocaleString("en-IN");
  return `${neg ? "-" : ""}₹${grouped}.${p}`;
}

/** Plain "3594.87" (no symbol/grouping) — handy for logs/CSV. */
export function rupeesPlain(paise: number): string {
  const rupees = Math.floor(paise / 100);
  const p = String(paise % 100).padStart(2, "0");
  return `${rupees}.${p}`;
}
