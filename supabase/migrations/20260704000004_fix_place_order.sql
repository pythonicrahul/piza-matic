-- Fix 42702: the RETURNS TABLE output column `token` shadowed orders.token in
-- `max(token)`. Qualify the table columns (orders.token / orders.placed_at).

create or replace function public.place_order(
  p_customer_id   uuid,
  p_name          text,
  p_phone         text,
  p_payment_mode  payment_mode,
  p_order_code    text,
  p_qty_total     int,
  p_subtotal      int,
  p_discount      int,
  p_gst           int,
  p_total         int,
  p_items         jsonb,
  p_delivery      jsonb default null
) returns table (order_id uuid, order_code text, token int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_token    int;
  v_item     jsonb;
  v_item_id  uuid;
  v_top      jsonb;
begin
  perform pg_advisory_xact_lock(hashtext('slicematic_order_token'));

  select coalesce(max(orders.token), 0) + 1
    into v_token
    from orders
   where (orders.placed_at at time zone 'Asia/Kolkata')::date
       = (now() at time zone 'Asia/Kolkata')::date;

  insert into orders (
    order_code, token, customer_id, name, phone,
    payment_mode, quantity_total, subtotal_paise, discount_paise, gst_paise, total_paise
  ) values (
    p_order_code, v_token, p_customer_id, p_name, p_phone,
    p_payment_mode, p_qty_total, p_subtotal, p_discount, p_gst, p_total
  ) returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into order_items (order_id, base_id, pizza_id, qty, unit_paise, line_paise, is_veg)
    values (
      v_order_id,
      (v_item->>'base_id')::uuid,
      (v_item->>'pizza_id')::uuid,
      (v_item->>'qty')::int,
      (v_item->>'unit_paise')::int,
      (v_item->>'line_paise')::int,
      case when v_item->>'is_veg' is null then null else (v_item->>'is_veg')::boolean end
    ) returning id into v_item_id;

    for v_top in select * from jsonb_array_elements(coalesce(v_item->'toppings', '[]'::jsonb)) loop
      insert into order_item_toppings (order_item_id, topping_id, price_paise)
      values (v_item_id, (v_top->>'topping_id')::uuid, (v_top->>'price_paise')::int);
    end loop;
  end loop;

  if p_delivery is not null then
    insert into deliveries (order_id, dropoff_lat, dropoff_lng, dropoff_address, distance_km)
    values (
      v_order_id,
      (p_delivery->>'lat')::double precision,
      (p_delivery->>'lng')::double precision,
      p_delivery->>'address',
      (p_delivery->>'distance_km')::numeric
    );
  end if;

  return query select v_order_id, p_order_code, v_token;
end;
$$;

revoke all on function public.place_order(uuid,text,text,payment_mode,text,int,int,int,int,int,jsonb,jsonb) from public, anon, authenticated;
