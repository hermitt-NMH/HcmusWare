-- =====================================================================
-- Giai đoạn 2 – Tuần 3: đơn hàng nhiều shop, sổ địa chỉ (F14 – US-14.7, F17 – US-17.1).
-- 1. orders: shop_id (mỗi đơn thuộc một shop) + payment_code (mã thanh toán chung của một lần đặt).
--    Đơn cũ: đơn chỉ có hàng của một shop → shop đó; đơn trộn nhiều shop (đặt trong Tuần 2,
--    trước khi tách) → shop HcmusWare, admin xử lý. Mỗi đơn cũ có mã thanh toán riêng "DH<id>".
-- 2. place_order: giỏ có hàng của nhiều shop → mỗi shop một đơn, cùng một mã "TT<số>".
--    Vẫn trả về id (đơn đầu tiên) như cũ để frontend, e2e và rls-test không phải đổi cách gọi.
-- 3. mock_pay_order: thanh toán một đơn = thanh toán cả nhóm đơn cùng mã (các đơn còn chờ trả).
-- 4. Trạng thái đơn chỉ đi tới (pending → confirmed → shipping → completed) hoặc hủy, chặn trong DB.
-- 5. RLS: chủ shop đọc đơn và sản phẩm trong đơn của shop mình (kể cả khi shop bị khóa,
--    để còn tra cứu); chỉ người bán của shop đang hoạt động mới đổi được trạng thái.
--    Cột được sửa vẫn chỉ có status (grant từ Tuần 5).
-- 6. addresses (mới): sổ địa chỉ, tối đa 10, luôn đúng 1 địa chỉ mặc định khi sổ không rỗng.
--
-- Online: chạy npm run db:backup TRƯỚC khi npx supabase db push.
-- Kiểm thử quyền: npm run test:rls (các ca T3-xx).
-- =====================================================================

-- ---------- 1. Đơn hàng thuộc về shop ----------

create sequence public.payment_code_seq;

alter table public.orders
  add column shop_id      bigint references public.shops (id),
  add column payment_code text;

update public.orders o
set shop_id = coalesce(
      (
        select min(p.shop_id)
        from public.order_items oi
        join public.products p on p.id = oi.product_id
        where oi.order_id = o.id
        having count(distinct p.shop_id) = 1
      ),
      public.house_shop_id()
    ),
    payment_code = 'DH' || o.id;

-- Mặc định cho script chạy bằng service role (seed, e2e) chèn đơn trực tiếp.
alter table public.orders
  alter column shop_id set default public.house_shop_id(),
  alter column shop_id set not null,
  alter column payment_code set default 'TT' || nextval('public.payment_code_seq'),
  alter column payment_code set not null;

create index orders_shop_idx on public.orders (shop_id, created_at desc);
create index orders_payment_code_idx on public.orders (payment_code);

-- Là chủ shop (mọi trạng thái shop). Khác can_manage_shop: không cần vai trò seller hay shop đang hoạt động.
create or replace function public.owns_shop(p_shop_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.shops where id = p_shop_id and owner_id = auth.uid());
$$;

-- ---------- 2. Đặt hàng: tách theo shop ----------
-- Giữ nguyên các kiểm tra của bản 20261123000000; khác ở chỗ mỗi shop một đơn.
create or replace function public.place_order(
  p_items jsonb,
  p_shipping_name text,
  p_shipping_phone text,
  p_shipping_address text,
  p_payment_method text default 'cod',
  p_note text default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code     text;
  v_order_id bigint;
  v_item     jsonb;
  v_line     record;
  v_product  public.products%rowtype;
  v_qty      int;
begin
  if auth.uid() is null then
    raise exception 'Bạn cần đăng nhập để đặt hàng';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Giỏ hàng trống';
  end if;
  if coalesce(trim(p_shipping_name), '') = ''
     or coalesce(trim(p_shipping_phone), '') = ''
     or coalesce(trim(p_shipping_address), '') = '' then
    raise exception 'Vui lòng nhập đủ họ tên, số điện thoại và địa chỉ giao hàng';
  end if;
  -- Cùng quy tắc với validateCheckout (src/features/orders/orders.js).
  if trim(p_shipping_phone) !~ '^(0|\+84)[0-9]{9}$' then
    raise exception 'Số điện thoại không hợp lệ (vd 0901234567)';
  end if;
  if length(trim(p_shipping_name)) > 100 then
    raise exception 'Họ tên tối đa 100 ký tự';
  end if;
  if length(trim(p_shipping_address)) < 10 or length(trim(p_shipping_address)) > 300 then
    raise exception 'Địa chỉ giao hàng phải từ 10 đến 300 ký tự';
  end if;
  if length(coalesce(trim(p_note), '')) > 500 then
    raise exception 'Ghi chú tối đa 500 ký tự';
  end if;
  if coalesce(p_payment_method, '') not in ('cod', 'mock_online') then
    raise exception 'Phương thức thanh toán không hợp lệ';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item ->> 'quantity')::int;
    if v_qty is null or v_qty <= 0 or v_qty > 10 or (v_item ->> 'product_id') is null then
      raise exception 'Số lượng không hợp lệ';
    end if;
  end loop;

  v_code := 'TT' || nextval('public.payment_code_seq');

  -- Khóa sản phẩm theo thứ tự id để 2 đơn cùng lúc không kẹt nhau. Gặp shop mới thì mở đơn mới.
  for v_line in
    select (e ->> 'product_id')::bigint as product_id, sum((e ->> 'quantity')::int) as qty
    from jsonb_array_elements(p_items) e
    group by 1
    order by 1
  loop
    if v_line.qty > 10 then
      raise exception 'Mỗi sản phẩm chỉ mua tối đa 10 chiếc một đơn';
    end if;

    select * into v_product from public.products where id = v_line.product_id for update;

    -- Sản phẩm chờ duyệt / đã ẩn / của shop bị khóa: báo như không tồn tại để không lộ thông tin.
    if not found or v_product.status <> 'active' or not public.shop_is_active(v_product.shop_id) then
      raise exception 'Sản phẩm % không tồn tại hoặc đã ngừng bán', v_line.product_id;
    end if;
    if v_product.stock < v_line.qty then
      raise exception 'Sản phẩm "%" chỉ còn % chiếc', v_product.name, v_product.stock;
    end if;

    select id into v_order_id
    from public.orders
    where payment_code = v_code and shop_id = v_product.shop_id;
    if not found then
      insert into public.orders (user_id, shop_id, payment_code, payment_method,
                                 shipping_name, shipping_phone, shipping_address, note)
      values (auth.uid(), v_product.shop_id, v_code, p_payment_method, trim(p_shipping_name),
              trim(p_shipping_phone), trim(p_shipping_address), nullif(trim(p_note), ''))
      returning id into v_order_id;
    end if;

    update public.products set stock = stock - v_line.qty where id = v_product.id;
    insert into public.order_items (order_id, product_id, quantity, unit_price)
    values (v_order_id, v_product.id, v_line.qty, v_product.price);
  end loop;

  update public.orders o
  set total = s.total
  from (
    select oi.order_id, sum(oi.unit_price * oi.quantity) as total
    from public.order_items oi
    join public.orders x on x.id = oi.order_id
    where x.payment_code = v_code
    group by oi.order_id
  ) s
  where o.id = s.order_id;

  return (select min(id) from public.orders where payment_code = v_code);
end;
$$;

-- ---------- 3. Thanh toán mô phỏng cả nhóm đơn ----------
-- Gọi với id của bất kỳ đơn nào trong nhóm. Đơn trong nhóm đã bị người bán hủy thì bỏ qua.
create or replace function public.mock_pay_order(p_order_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found or v_order.user_id is distinct from auth.uid() then
    raise exception 'Không tìm thấy đơn hàng';
  end if;
  if v_order.payment_method <> 'mock_online' then
    raise exception 'Đơn này thanh toán khi nhận hàng (COD)';
  end if;

  -- Khóa cả nhóm theo thứ tự id trước khi kiểm tra, tránh bấm "Thanh toán" 2 lần cùng lúc.
  perform 1 from public.orders where payment_code = v_order.payment_code order by id for update;

  update public.orders
  set paid_at = now(), status = 'confirmed'
  where payment_code = v_order.payment_code
    and user_id = auth.uid()
    and payment_method = 'mock_online'
    and paid_at is null
    and status = 'pending';
  if not found then
    if exists (select 1 from public.orders where payment_code = v_order.payment_code and paid_at is not null) then
      raise exception 'Đơn này đã được thanh toán';
    end if;
    raise exception 'Đơn này không còn chờ thanh toán';
  end if;
end;
$$;

-- ---------- 4. Đổi trạng thái đơn: chỉ đi tới ----------
-- Trước chỉ giao diện admin chặn lùi (nextStatuses). Người bán gọi API thẳng thì lùi được
-- (vd "Đang giao" → "Chờ xác nhận") → chặn trong DB. Giữ nguyên các kiểm tra của bản 20261023000000.
create or replace function public.handle_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_flow text[] := array['pending', 'confirmed', 'shipping', 'completed'];
begin
  if new.status is not distinct from old.status then
    return new;
  end if;
  if old.status in ('completed', 'cancelled') then
    raise exception 'Đơn đã % thì không đổi trạng thái được nữa',
      case old.status when 'completed' then 'hoàn tất' else 'hủy' end;
  end if;
  -- 'cancelled' không nằm trong v_flow → array_position null → không vướng điều kiện này.
  if array_position(v_flow, new.status) < array_position(v_flow, old.status) then
    raise exception 'Không chuyển đơn về trạng thái trước đó';
  end if;

  -- Đơn online chưa thanh toán: chỉ hủy được (mock_pay_order đặt paid_at cùng lúc nên vẫn qua).
  if old.payment_method = 'mock_online' and new.paid_at is null and new.status <> 'cancelled' then
    raise exception 'Đơn thanh toán online chưa được thanh toán, chỉ có thể hủy';
  end if;

  -- Hủy đơn: trả lại hàng vào kho.
  if new.status = 'cancelled' then
    update public.products p
    set stock = p.stock + s.qty
    from (
      select product_id, sum(quantity) as qty
      from public.order_items
      where order_id = new.id
      group by product_id
    ) s
    where s.product_id = p.id;
  end if;

  -- COD giao xong coi như đã thu tiền.
  if new.status = 'completed' and new.paid_at is null then
    new.paid_at := now();
  end if;
  return new;
end;
$$;

-- ---------- 5. RLS đơn hàng ----------

drop policy if exists "orders_read" on public.orders;
drop policy if exists "orders_admin_update" on public.orders;

create policy "orders_read" on public.orders for select
  using (user_id = auth.uid() or public.is_admin() or public.owns_shop(shop_id));
-- Chỉ sửa được cột status (grant Tuần 5). Người bán của shop bị khóa / bị hạ vai trò thì mất quyền.
create policy "orders_update" on public.orders for update
  using (public.is_admin() or public.can_manage_shop(shop_id))
  with check (public.is_admin() or public.can_manage_shop(shop_id));

drop policy if exists "order_items_read" on public.order_items;
create policy "order_items_read" on public.order_items for select using (
  public.is_admin()
  or exists (
    select 1 from public.orders o
    where o.id = order_id and (o.user_id = auth.uid() or public.owns_shop(o.shop_id))
  )
);

-- ---------- 6. Sổ địa chỉ ----------
-- Lưu cả mã (Tổng cục Thống kê, ổn định) và tên lúc chọn (hiện ngay, không cần tải file đơn vị hành chính).
-- Đơn hàng vẫn lưu bản sao địa chỉ dạng chữ (orders.shipping_address) → sửa sổ không đổi đơn cũ (US-17.3).

create table public.addresses (
  id             bigint generated always as identity primary key,
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  recipient_name text not null check (length(trim(recipient_name)) between 2 and 60),
  phone          text not null check (phone ~ '^0[0-9]{9}$'),
  province_code  text not null check (province_code ~ '^[0-9]{2}$'),
  province_name  text not null check (length(province_name) between 1 and 100),
  ward_code      text not null check (ward_code ~ '^[0-9]{5}$'),
  ward_name      text not null check (length(ward_name) between 1 and 100),
  street         text not null check (length(trim(street)) between 1 and 200),
  is_default     boolean not null default false,
  created_at     timestamptz not null default now()
);
create index addresses_user_idx on public.addresses (user_id, created_at desc);
create unique index addresses_one_default on public.addresses (user_id) where is_default;

alter table public.addresses enable row level security;
create policy "addresses_own" on public.addresses for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Giữ đúng 1 địa chỉ mặc định:
-- - thêm địa chỉ đầu tiên → mặc định; tối đa 10 địa chỉ
-- - đặt một địa chỉ làm mặc định → bỏ mặc định của địa chỉ cũ
-- - không bỏ mặc định trực tiếp được (phải chọn địa chỉ khác làm mặc định)
-- pg_trigger_depth() > 1: lệnh bỏ mặc định do chính trigger này chạy.
create or replace function public.guard_address_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if (select count(*) from public.addresses where user_id = new.user_id) >= 10 then
      raise exception 'Sổ địa chỉ tối đa 10 địa chỉ';
    end if;
    if not exists (select 1 from public.addresses where user_id = new.user_id) then
      new.is_default := true;
    end if;
  elsif new.user_id is distinct from old.user_id then
    raise exception 'Không chuyển được địa chỉ sang tài khoản khác';
  elsif old.is_default and not new.is_default then
    raise exception 'Chọn địa chỉ khác làm mặc định thay vì bỏ mặc định';
  end if;

  if new.is_default and (tg_op = 'INSERT' or not old.is_default) then
    update public.addresses set is_default = false
    where user_id = new.user_id and is_default and id is distinct from new.id;
  end if;
  return new;
end;
$$;

create trigger addresses_guard_write
  before insert or update on public.addresses
  for each row execute function public.guard_address_write();

-- Xóa địa chỉ mặc định → địa chỉ thêm gần nhất thành mặc định.
create or replace function public.reassign_default_address()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.is_default then
    update public.addresses set is_default = true
    where id = (
      select id from public.addresses
      where user_id = old.user_id
      order by created_at desc, id desc
      limit 1
    );
  end if;
  return null;
end;
$$;

create trigger addresses_reassign_default
  after delete on public.addresses
  for each row execute function public.reassign_default_address();
