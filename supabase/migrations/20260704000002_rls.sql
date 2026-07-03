-- Row-Level Security. See docs/STAGE3_SPEC.md §4.3.
--
-- Model:
--   • Customer order writes go through server routes using the SERVICE ROLE key,
--     which BYPASSES RLS entirely. So there are no customer policies here.
--   • Public (anon) may read the available menu + settings + forecasts.
--   • Admin (profiles.role='admin') may read/write everything via the dashboard.
--   • Rider (profiles.role='rider') may read/update only their own deliveries
--     and read the orders attached to them.

-- Role helpers (SECURITY DEFINER so they can read profiles under RLS).
create or replace function public.app_role() returns app_role
  language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function public.is_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin')
$$;

-- Enable RLS on every table.
alter table settings            enable row level security;
alter table menu_items          enable row level security;
alter table customers           enable row level security;
alter table profiles            enable row level security;
alter table orders              enable row level security;
alter table order_items         enable row level security;
alter table order_item_toppings enable row level security;
alter table deliveries          enable row level security;
alter table ai_recommendations  enable row level security;
alter table forecast_runs       enable row level security;
alter table demand_forecasts    enable row level security;

-- Base grants (RLS still gates rows).
grant usage on schema public to anon, authenticated;
grant select on settings, menu_items, demand_forecasts, forecast_runs to anon, authenticated;
grant select on customers, orders, order_items, order_item_toppings, ai_recommendations to authenticated;
grant select, update on deliveries to authenticated;
grant update on orders, settings to authenticated;
grant insert, update, delete on menu_items to authenticated;

-- settings: public read, admin write.
create policy settings_read   on settings for select using (true);
create policy settings_write  on settings for update using (public.is_admin());

-- menu_items: public reads available items; admin manages all.
create policy menu_read       on menu_items for select using (is_available or public.is_admin());
create policy menu_admin_all  on menu_items for all    using (public.is_admin()) with check (public.is_admin());

-- forecasts: admin only (dashboard).
create policy fc_runs_admin   on forecast_runs    for select using (public.is_admin());
create policy fc_admin        on demand_forecasts for select using (public.is_admin());

-- profiles: a user sees their own row; admin sees all.
create policy profiles_self   on profiles for select using (id = auth.uid() or public.is_admin());

-- customers / recommendations: admin read (customer path uses service role).
create policy customers_admin on customers          for select using (public.is_admin());
create policy airecs_admin    on ai_recommendations for select using (public.is_admin());

-- orders: admin full; rider reads orders attached to a delivery assigned to them.
create policy orders_admin    on orders for all using (public.is_admin()) with check (public.is_admin());
create policy orders_rider    on orders for select using (
  exists (select 1 from deliveries d where d.order_id = orders.id and d.rider_id = auth.uid())
);

-- order_items / toppings: follow the parent order's visibility.
create policy oi_admin        on order_items for select using (public.is_admin());
create policy oi_rider        on order_items for select using (
  exists (
    select 1 from deliveries d
    where d.order_id = order_items.order_id and d.rider_id = auth.uid()
  )
);
create policy oit_admin       on order_item_toppings for select using (public.is_admin());
create policy oit_rider       on order_item_toppings for select using (
  exists (
    select 1
    from order_items oi
    join deliveries d on d.order_id = oi.order_id
    where oi.id = order_item_toppings.order_item_id and d.rider_id = auth.uid()
  )
);

-- deliveries: admin full; rider reads + updates only their own.
create policy deliveries_admin on deliveries for all using (public.is_admin()) with check (public.is_admin());
create policy deliveries_rider_read   on deliveries for select using (rider_id = auth.uid());
create policy deliveries_rider_update on deliveries for update using (rider_id = auth.uid()) with check (rider_id = auth.uid());
