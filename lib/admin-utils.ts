// Pure admin helpers (no server/db deps) — safe to unit test.

export interface OrderFilters {
  from?: string | null; // ISO timestamptz (inclusive)
  to?: string | null; // ISO timestamptz (exclusive)
  payment?: string | null; // cash | card | upi
}

const PAYMENTS = new Set(["cash", "card", "upi"]);

/**
 * Turn raw date/payment search params into normalized filters. Dates are
 * interpreted as IST calendar days; `to` becomes the exclusive start of the
 * following day so the whole `to` day is included.
 */
export function normalizeFilters(params: { from?: string; to?: string; payment?: string }): OrderFilters {
  const toIso = (d: string | undefined, addDay = false) => {
    if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
    const base = new Date(`${d}T00:00:00+05:30`);
    if (Number.isNaN(base.getTime())) return null;
    if (addDay) base.setDate(base.getDate() + 1);
    return base.toISOString();
  };
  return {
    from: toIso(params.from),
    to: toIso(params.to, true),
    payment: params.payment && PAYMENTS.has(params.payment) ? params.payment : null,
  };
}

/** RFC-4180 CSV cell: quote if it contains a comma, quote, or newline. */
export function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
