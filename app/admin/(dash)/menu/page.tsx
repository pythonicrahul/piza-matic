import { getFullMenu } from "@/lib/data/menu";
import { MenuEditor, type EditableItem, type MenuGroups } from "@/components/admin/menu-editor";

export const dynamic = "force-dynamic";

export default async function AdminMenuPage() {
  const menu = await getFullMenu();

  const map = (arr: typeof menu.pizza): EditableItem[] =>
    arr.map((i) => ({
      id: i.id,
      name: i.name,
      price_paise: i.price_paise,
      is_veg: i.is_veg ?? null,
      is_available: i.is_available,
    }));

  const groups: MenuGroups = { pizza: map(menu.pizza), base: map(menu.base), topping: map(menu.topping) };

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold">Menu &amp; pricing</h1>
        <p className="text-sm text-muted">
          Edit a price and hit Save, or toggle availability. Changes apply across the app instantly.
        </p>
      </div>
      <MenuEditor groups={groups} />
    </div>
  );
}
