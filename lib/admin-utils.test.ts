import { describe, expect, it } from "vitest";
import { normalizeFilters, csvCell } from "./admin-utils";

describe("normalizeFilters", () => {
  it("returns nulls for empty input", () => {
    expect(normalizeFilters({})).toEqual({ from: null, to: null, payment: null });
  });

  it("parses a from-date as IST midnight", () => {
    const f = normalizeFilters({ from: "2026-07-04" });
    // 2026-07-04 00:00 IST == 2026-07-03 18:30 UTC
    expect(f.from).toBe("2026-07-03T18:30:00.000Z");
  });

  it("makes `to` the exclusive start of the NEXT IST day", () => {
    const f = normalizeFilters({ to: "2026-07-04" });
    // start of 2026-07-05 IST == 2026-07-04 18:30 UTC
    expect(f.to).toBe("2026-07-04T18:30:00.000Z");
  });

  it("ignores malformed dates", () => {
    expect(normalizeFilters({ from: "07/04/2026", to: "nonsense" })).toMatchObject({ from: null, to: null });
  });

  it("only allows known payment modes", () => {
    expect(normalizeFilters({ payment: "cash" }).payment).toBe("cash");
    expect(normalizeFilters({ payment: "upi" }).payment).toBe("upi");
    expect(normalizeFilters({ payment: "bitcoin" }).payment).toBeNull();
    expect(normalizeFilters({ payment: "" }).payment).toBeNull();
  });
});

describe("csvCell", () => {
  it("leaves plain values unquoted", () => {
    expect(csvCell("PM-123")).toBe("PM-123");
    expect(csvCell(42)).toBe("42");
  });
  it("quotes and escapes values with commas, quotes, or newlines", () => {
    expect(csvCell("Doe, John")).toBe('"Doe, John"');
    expect(csvCell('he said "hi"')).toBe('"he said ""hi"""');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
  });
});
