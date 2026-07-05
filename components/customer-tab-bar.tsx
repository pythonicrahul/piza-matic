"use client";

import { TabBar, TabLink, MenuIcon, ChatIcon, CartIcon, OrdersIcon, UserIcon } from "./tab-bar";
import { useCart } from "./cart-provider";

export function CustomerTabBar() {
  const { count } = useCart();
  return (
    <TabBar>
      <TabLink href="/" label="Menu" icon={MenuIcon} exact />
      <TabLink href="/chat" label="Sage" icon={ChatIcon} />
      <TabLink href="/cart" label="Cart" icon={CartIcon} badge={count} />
      <TabLink href="/orders" label="Orders" icon={OrdersIcon} />
      <TabLink href="/account" label="Account" icon={UserIcon} />
    </TabBar>
  );
}
