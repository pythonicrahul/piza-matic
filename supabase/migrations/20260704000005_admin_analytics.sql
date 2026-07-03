-- Admin analytics in one indexed query. Returns a JSON summary for the dashboard:
-- revenue, order count, AOV, top-selling pizza, busiest hour, per-hour histogram,
-- and payment-mode breakdown — all respecting the date + payment-mode filters.
--
-- SECURITY DEFINER + an is_admin() guard: only admins can run it, and it can read
-- across all orders regardless of the caller's RLS.

create or replace function public.admin_analytics(
  p_from    timestamptz default null,
  p_to      timestamptz default null,
  p_payment text        default null
) returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result json;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  with filtered as (
    select *
    from orders o
    where (p_from is null or o.placed_at >= p_from)
      and (p_to   is null or o.placed_at <  p_to)
      and (p_payment is null or o.payment_mode = p_payment::payment_mode)
  ),
  top_pizza as (
    select mi.name, sum(oi.qty)::int as qty
    from filtered f
    join order_items oi on oi.order_id = f.id
    join menu_items  mi on mi.id = oi.pizza_id
    group by mi.name
    order by qty desc
    limit 1
  ),
  by_hour as (
    select extract(hour from (placed_at at time zone 'Asia/Kolkata'))::int as hour,
           count(*)::int as cnt
    from filtered
    group by 1
  )
  select json_build_object(
    'order_count',   (select count(*)::int from filtered),
    'revenue_paise', (select coalesce(sum(total_paise), 0)::bigint from filtered),
    'aov_paise',     (select coalesce(round(avg(total_paise)), 0)::int from filtered),
    'top_pizza',     (select json_build_object('name', name, 'qty', qty) from top_pizza),
    'busiest_hour',  (select json_build_object('hour', hour, 'count', cnt)
                        from by_hour order by cnt desc, hour limit 1),
    'by_hour',       (select coalesce(json_agg(json_build_object('hour', hour, 'count', cnt) order by hour), '[]')
                        from by_hour),
    'payment_breakdown', (
      select coalesce(json_agg(json_build_object('mode', payment_mode, 'count', c)), '[]')
      from (select payment_mode, count(*)::int c from filtered group by payment_mode) p
    )
  ) into result;

  return result;
end;
$$;

grant execute on function public.admin_analytics(timestamptz, timestamptz, text) to authenticated;
