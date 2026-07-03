import { KitchenBoard } from "@/components/admin/kitchen-board";

export const dynamic = "force-dynamic";

export default function KitchenPage() {
  return (
    <div>
      <h1 className="mb-1 text-2xl font-extrabold">Kitchen Display</h1>
      <p className="mb-5 text-sm text-muted">Today&apos;s orders · auto-refreshes every 8s</p>
      <KitchenBoard />
    </div>
  );
}
