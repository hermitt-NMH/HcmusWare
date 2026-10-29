-- =====================================================================
-- Giai đoạn 2 – Tuần 5: thông báo trong web (F12 – US-12.1, US-12.2; thay Zalo OA).
-- 1. notifications (mới): user_id, type, title, body, link, read_at, created_at.
--    Người dùng chỉ ĐỌC được thông báo của mình; đánh dấu đã đọc qua mark_notifications_read.
--    Không ai tạo thông báo từ frontend: mọi thông báo do trigger trong DB tạo (add_notification).
-- 2. Trigger tạo thông báo:
--    Khách hàng  – giá xuống tới giá mong muốn (thay thanh "Giá đã giảm"; mỗi lần đặt giá chỉ báo 1 lần:
--                  báo xong đặt price_alerts.notified = true, đặt lại giá mong muốn thì báo lại);
--                – đơn chuyển Đã xác nhận / Đang giao / Hoàn tất / Đã hủy;
--                – người bán trả lời câu hỏi của mình.
--    Người bán   – shop được duyệt / bị từ chối (kèm lý do) / bị khóa / được mở khóa;
--                – sản phẩm được duyệt / bị trả lại (kèm lý do) / bị gỡ;
--                – shop có đơn mới; có câu hỏi mới trên sản phẩm của shop.
--    Không báo cho chính người vừa làm việc đó (vd khách tự thanh toán online → đơn Đã xác nhận).
--    Shop HcmusWare do admin quản lý ở /admin (C5) nên không tạo thông báo "người bán" cho shop này.
-- 3. Cảnh báo giá đã đạt mà chưa báo (trước migration) được chuyển thành thông báo.
--
-- Online: chạy npm run db:backup TRƯỚC khi npx supabase db push.
-- Kiểm thử quyền: npm run test:rls (các ca T5-xx).
-- =====================================================================

-- ---------- 1. Bảng thông báo ----------

create table public.notifications (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  type        text not null check (type in (
                'price_drop', 'order_status', 'question_answered',
                'shop_review', 'product_review', 'order_new', 'question_new')),
  title       text not null,
  body        text not null default '',
  link        text,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc, id desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;
create policy "notifications_read_own" on public.notifications for select
  using (user_id = auth.uid());

-- Chỉ đọc. Ghi duy nhất qua trigger (security definer) và mark_notifications_read.
revoke all on public.notifications from anon;
revoke insert, update, delete on public.notifications from authenticated;
grant select on public.notifications to authenticated;

-- Đánh dấu đã đọc. p_ids null = tất cả thông báo chưa đọc của mình. Trả về số thông báo vừa đánh dấu.
create or replace function public.mark_notifications_read(p_ids bigint[] default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if auth.uid() is null then
    raise exception 'Bạn cần đăng nhập';
  end if;
  update public.notifications
  set read_at = now()
  where user_id = auth.uid()
    and read_at is null
    and (p_ids is null or id = any (p_ids));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.mark_notifications_read(bigint[]) from public, anon;
grant execute on function public.mark_notifications_read(bigint[]) to authenticated;

-- ---------- 2. Hàm dùng chung ----------

-- 5490000 → "5.490.000 ₫" (cùng kiểu formatPrice ở src/lib/format.js).
create or replace function public.format_vnd(p_amount bigint)
returns text
language sql
immutable
as $$
  select replace(to_char(coalesce(p_amount, 0), 'FM999,999,999,999,990'), ',', '.') || ' ₫';
$$;

-- Nội dung người dùng gõ có thể dài: cắt còn p_max ký tự, thêm "…".
create or replace function public.clip(p_text text, p_max int)
returns text
language sql
immutable
as $$
  select case when length(p_text) > p_max then rtrim(left(p_text, p_max - 1)) || '…' else p_text end;
$$;

create or replace function public.add_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_link text
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.notifications (user_id, type, title, body, link)
  select p_user_id, p_type, p_title, coalesce(p_body, ''), p_link
  where p_user_id is not null;
$$;

-- Hàm nội bộ cho trigger: không cho gọi qua API (tránh tự tạo thông báo cho người khác).
revoke execute on function public.add_notification(uuid, text, text, text, text) from public, anon, authenticated;

-- Chủ shop cần nhận thông báo "người bán": shop không phải HcmusWare và chủ không phải người đang thao tác.
create or replace function public.seller_to_notify(p_shop_id bigint)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select s.owner_id
  from public.shops s
  where s.id = p_shop_id
    and s.slug <> 'hcmusware'
    and s.owner_id is distinct from auth.uid();
$$;

revoke execute on function public.seller_to_notify(bigint) from public, anon, authenticated;

-- ---------- 3. Cảnh báo giá ----------

-- Báo các cảnh báo đã đạt giá của một sản phẩm (p_alert_id null = mọi cảnh báo của sản phẩm),
-- rồi đặt notified = true để chỉ báo 1 lần. Sản phẩm không hiện với khách thì chưa báo.
create or replace function public.notify_price_alerts(p_product_id bigint, p_alert_id bigint default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.products%rowtype;
  v_alert   public.price_alerts%rowtype;
begin
  select * into v_product from public.products where id = p_product_id;
  if not found or v_product.status <> 'active' or not public.shop_is_active(v_product.shop_id) then
    return;
  end if;

  for v_alert in
    update public.price_alerts
    set notified = true
    where product_id = p_product_id
      and (p_alert_id is null or id = p_alert_id)
      and not notified
      and target_price >= v_product.price
    returning *
  loop
    perform public.add_notification(
      v_alert.user_id,
      'price_drop',
      'Giá đã giảm tới mức bạn mong muốn',
      v_product.name || ' chỉ còn ' || public.format_vnd(v_product.price)
        || ' (bạn muốn ≤ ' || public.format_vnd(v_alert.target_price) || ')',
      '/san-pham/' || p_product_id
    );
  end loop;
end;
$$;

revoke execute on function public.notify_price_alerts(bigint, bigint) from public, anon, authenticated;

create or replace function public.products_notify_price()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Giá giảm, hoặc sản phẩm vừa hiện lại (duyệt lại / mở khóa không qua đây) với giá đã đạt.
  if new.price < old.price or (new.status = 'active' and old.status <> 'active') then
    perform public.notify_price_alerts(new.id);
  end if;
  return null;
end;
$$;

create trigger products_notify_price
  after update of price, status on public.products
  for each row execute function public.products_notify_price();

-- Đặt / đổi giá mong muốn khi giá hiện tại đã đạt (gọi thẳng API; giao diện chặn trường hợp này).
create or replace function public.price_alerts_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not new.notified then
    perform public.notify_price_alerts(new.product_id, new.id);
  end if;
  return null;
end;
$$;

create trigger price_alerts_notify
  after insert or update of target_price, notified on public.price_alerts
  for each row execute function public.price_alerts_notify();

-- ---------- 4. Đơn hàng ----------

-- Đơn đổi trạng thái → báo khách (trừ khi chính khách làm, vd thanh toán online).
create or replace function public.orders_notify_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_label text := case new.status
    when 'confirmed' then 'Đã xác nhận'
    when 'shipping'  then 'Đang giao'
    when 'completed' then 'Hoàn tất'
    when 'cancelled' then 'Đã hủy'
  end;
begin
  if new.status is distinct from old.status and v_label is not null
     and new.user_id is distinct from auth.uid() then
    perform public.add_notification(
      new.user_id,
      'order_status',
      'Đơn hàng #' || new.id || ': ' || v_label,
      (select name from public.shops where id = new.shop_id) || ' đã chuyển đơn sang "' || v_label || '".',
      '/don-hang/' || new.id
    );
  end if;
  return null;
end;
$$;

create trigger orders_notify_status
  after update of status on public.orders
  for each row execute function public.orders_notify_status();

-- Đơn mới → báo người bán. place_order thêm sản phẩm và tính tổng tiền SAU khi tạo đơn,
-- nên trigger chạy lúc commit (deferred) để đọc được tổng tiền và số sản phẩm.
create or replace function public.orders_notify_new()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_qty   bigint;
begin
  select * into v_order from public.orders where id = new.id;
  if not found then
    return null; -- đơn đã bị xóa trong cùng transaction (script test)
  end if;
  select coalesce(sum(quantity), 0) into v_qty from public.order_items where order_id = new.id;
  perform public.add_notification(
    public.seller_to_notify(v_order.shop_id),
    'order_new',
    'Shop có đơn mới #' || v_order.id,
    v_qty || ' sản phẩm, ' || public.format_vnd(v_order.total)
      || case when v_order.payment_method = 'mock_online' and v_order.paid_at is null
              then ' · chờ khách thanh toán online' else '' end,
    '/kenh-nguoi-ban/don-hang'
  );
  return null;
end;
$$;

create constraint trigger orders_notify_new
  after insert on public.orders
  deferrable initially deferred
  for each row execute function public.orders_notify_new();

-- ---------- 5. Duyệt shop và sản phẩm ----------

create or replace function public.shops_notify_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid := public.seller_to_notify(new.id);
begin
  if new.status is not distinct from old.status or v_owner is null then
    return null;
  end if;
  if old.status = 'pending' and new.status = 'active' then
    perform public.add_notification(v_owner, 'shop_review', 'Shop đã được duyệt',
      'Shop "' || new.name || '" đã hoạt động. Bạn có thể đăng sản phẩm trong Kênh người bán.',
      '/kenh-nguoi-ban');
  elsif new.status = 'rejected' then
    perform public.add_notification(v_owner, 'shop_review', 'Shop chưa được duyệt',
      'Lý do: ' || coalesce(new.review_note, '') || '. Bạn có thể sửa và gửi lại.',
      '/tai-khoan/mo-shop');
  elsif new.status = 'locked' then
    perform public.add_notification(v_owner, 'shop_review', 'Shop đã bị khóa',
      'Shop "' || new.name || '" bị admin khóa, sản phẩm của shop tạm ẩn với khách.',
      '/kenh-nguoi-ban');
  elsif old.status = 'locked' and new.status = 'active' then
    perform public.add_notification(v_owner, 'shop_review', 'Shop đã được mở khóa',
      'Shop "' || new.name || '" hoạt động trở lại.',
      '/kenh-nguoi-ban');
  end if;
  return null;
end;
$$;

create trigger shops_notify_status
  after update of status on public.shops
  for each row execute function public.shops_notify_status();

-- Người bán tự đổi trạng thái (ẩn, gửi lại, sửa thông số → chờ duyệt) thì không báo:
-- seller_to_notify trả null khi người thao tác là chủ shop.
create or replace function public.products_notify_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_link  text := '/kenh-nguoi-ban/san-pham/' || new.id;
begin
  if new.status is not distinct from old.status then
    return null;
  end if;
  v_owner := public.seller_to_notify(new.shop_id);
  if v_owner is null then
    return null;
  end if;
  if old.status = 'pending' and new.status = 'active' then
    perform public.add_notification(v_owner, 'product_review', 'Sản phẩm đã được duyệt',
      new.name || ' đã hiện với khách.', v_link);
  elsif old.status = 'pending' and new.status = 'hidden' then
    perform public.add_notification(v_owner, 'product_review', 'Sản phẩm bị trả lại',
      new.name || '. Lý do: ' || coalesce(new.review_note, ''), v_link);
  elsif old.status = 'active' and new.status = 'hidden' then
    perform public.add_notification(v_owner, 'product_review', 'Sản phẩm bị gỡ',
      new.name || ' đã bị admin ẩn với khách.', v_link);
  end if;
  return null;
end;
$$;

create trigger products_notify_review
  after update of status on public.products
  for each row execute function public.products_notify_review();

-- ---------- 6. Hỏi đáp ----------

create or replace function public.comments_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.products%rowtype;
  v_asker   uuid;
begin
  select * into v_product from public.products where id = new.product_id;

  if new.parent_id is null then
    -- seller_to_notify bỏ qua khi chủ shop tự hỏi trên sản phẩm của mình.
    perform public.add_notification(
      public.seller_to_notify(v_product.shop_id),
      'question_new',
      'Câu hỏi mới về sản phẩm',
      v_product.name || ': ' || public.clip(new.body, 120),
      '/kenh-nguoi-ban/cau-hoi'
    );
  elsif new.is_seller then
    select user_id into v_asker from public.comments where id = new.parent_id;
    if v_asker is distinct from new.user_id then
      perform public.add_notification(
        v_asker,
        'question_answered',
        'Người bán đã trả lời câu hỏi của bạn',
        v_product.name || ': ' || public.clip(new.body, 120),
        '/san-pham/' || new.product_id
      );
    end if;
  end if;
  return null;
end;
$$;

create trigger comments_notify
  after insert on public.comments
  for each row execute function public.comments_notify();

-- ---------- 7. Chuyển cảnh báo giá đã đạt (chưa bấm "Đã xem") thành thông báo ----------

select public.notify_price_alerts(product_id)
from (select distinct product_id from public.price_alerts where not notified) a;
