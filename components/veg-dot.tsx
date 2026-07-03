// The familiar veg / non-veg square marker.
export function VegDot({ isVeg }: { isVeg?: boolean | null }) {
  if (isVeg === null || isVeg === undefined) return null;
  const color = isVeg ? "var(--veg)" : "var(--nonveg)";
  return (
    <span
      aria-label={isVeg ? "Veg" : "Non-veg"}
      className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-[3px] border"
      style={{ borderColor: color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
    </span>
  );
}
