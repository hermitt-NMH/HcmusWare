-- =====================================================================
-- Sửa lỗi QA G2T5 (BUG-G2T5-01): giá giảm tới giá mong muốn trong lúc shop bị khóa thì
-- notify_price_alerts bỏ qua (sản phẩm đang ẩn với khách – đúng), nhưng mở khóa shop chỉ đổi
-- shops.status, giá và trạng thái sản phẩm không đổi nên không trigger nào báo lại.
-- Khách thấy sản phẩm hiện lại với giá đã đạt mà không có thông báo / email.
-- → Shop chuyển sang hoạt động (mở khóa, được duyệt) thì xét lại cảnh báo giá của mọi sản phẩm trong shop.
-- notify_price_alerts tự bỏ qua sản phẩm chưa đạt giá, không đang bán, hoặc đã báo (notified = true).
-- Online: chạy npm run db:backup TRƯỚC khi npx supabase db push.
-- Kiểm thử: npm run test:rls (ca T5-11).
-- =====================================================================

create or replace function public.shops_notify_price()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_id bigint;
begin
  if new.status = 'active' and old.status is distinct from 'active' then
    for v_product_id in
      select distinct a.product_id
      from public.price_alerts a
      join public.products p on p.id = a.product_id
      where p.shop_id = new.id and not a.notified
    loop
      perform public.notify_price_alerts(v_product_id);
    end loop;
  end if;
  return null;
end;
$$;

create trigger shops_notify_price
  after update of status on public.shops
  for each row execute function public.shops_notify_price();
