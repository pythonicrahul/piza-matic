const STATUS_STYLE: Record<string, string> = {
  placed: "bg-stone-100 text-stone-700",
  confirmed: "bg-amber-100 text-amber-800",
  preparing: "bg-orange-100 text-orange-800",
  ready: "bg-emerald-100 text-emerald-800",
  out_for_delivery: "bg-sky-100 text-sky-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

export function StatusPill({ status }: { status: string }) {
  const cls = STATUS_STYLE[status] ?? "bg-stone-100 text-stone-700";
  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${cls}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
