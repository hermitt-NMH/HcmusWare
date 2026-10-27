-- =====================================================================
-- Giai đoạn 2 – Tuần 1: nền phân quyền cho marketplace (F13, chuẩn bị F14, F15).
-- 1. profiles.role thêm 'seller'; hàm is_seller(). Chỉ admin đổi được vai trò (set_user_role),
--    admin xem danh sách người dùng kèm email (admin_list_users).
-- 2. shops (mới): mỗi người tối đa 1 shop, trạng thái pending / active / locked.
--    Shop "HcmusWare" của admin giữ toàn bộ sản phẩm cũ để dữ liệu và đơn cũ vẫn chạy.
-- 3. brands (mới): tách từ cột text products.brand → products.brand_id.
--    Cột brand giữ lại (trigger đồng bộ) vì frontend và import-dataset.js còn đọc/ghi nó.
-- 4. products: shop_id, brand_id, status (pending / active / hidden), approved_at.
--    Khách chỉ thấy sản phẩm đang bán (active) của shop đang hoạt động.
-- 5. RLS viết lại cho products, shops, brands; place_order chặn mua sản phẩm không được bán.
--
-- Online: chạy npm run db:backup TRƯỚC khi npx supabase db push.
-- Kiểm thử quyền 3 vai trò: npm run test:rls (scripts/rls-test.js).
-- =====================================================================

-- ---------- 1. Vai trò ----------

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('customer', 'seller', 'admin'));

create or replace function public.is_seller()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'seller');
$$;

-- Đường dẫn thân thiện từ tên: "be quiet!" → "be-quiet", "G.Skill" → "g-skill".
-- Chỉ xử lý chữ không dấu (tên thương hiệu); tên shop tiếng Việt sẽ do frontend tạo slug.
create or replace function public.slugify(p_text text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(lower(coalesce(p_text, '')), '[^a-z0-9]+', '-', 'g'));
$$;

-- ---------- 2. Shop ----------

create table public.shops (
  id           bigint generated always as identity primary key,
  -- Chỉ shop HcmusWare được để trống chủ, khi DB mới tạo chưa có admin (seed.sql gán sau).
  owner_id     uuid unique references auth.users (id) on delete restrict,
  name         text not null check (length(trim(name)) between 2 and 80),
  slug         text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description  text check (length(description) <= 2000),
  logo_url     text,
  status       text not null default 'pending' check (status in ('pending', 'active', 'locked')),
  created_at   timestamptz not null default now()
);

insert into public.shops (owner_id, name, slug, description, status)
values (
  (select id from public.profiles where role = 'admin' order by created_at limit 1),
  'HcmusWare',
  'hcmusware',
  'Cửa hàng chính thức của HcmusWare',
  'active'
);

-- Shop mặc định cho sản phẩm thêm bởi admin hoặc script (seed.sql, import-dataset.js).
create or replace function public.house_shop_id()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select id from public.shops where slug = 'hcmusware';
$$;

create or replace function public.shop_is_active(p_shop_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.shops where id = p_shop_id and status = 'active');
$$;

-- Người bán quản lý được sản phẩm của shop: là chủ shop, vai trò seller, shop đang hoạt động.
-- Shop bị khóa hoặc người bán bị hạ vai trò thì mất quyền ghi ngay.
create or replace function public.can_manage_shop(p_shop_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_seller() and exists (
    select 1
    from public.shops s
    where s.id = p_shop_id
      and s.owner_id = auth.uid()
      and s.status = 'active'
  );
$$;

-- ---------- 3. Thương hiệu ----------

create table public.brands (
  id          bigint generated always as identity primary key,
  name        text not null unique check (length(trim(name)) between 1 and 60),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  logo_url    text,
  created_at  timestamptz not null default now()
);

-- Gộp tên viết khác nhau ("Asus" / "ASUS") theo slug, lấy cách viết dùng nhiều nhất.
insert into public.brands (name, slug)
select distinct on (slug) name, slug
from (
  select left(trim(brand), 60) as name, public.slugify(brand) as slug, count(*) as n
  from public.products
  where public.slugify(brand) <> ''
  group by 1, 2
) t
order by slug, n desc, name;

-- ---------- 4. Sản phẩm ----------

-- status mặc định 'active' để 128 sản phẩm cũ và sản phẩm admin/script thêm vẫn bán ngay;
-- người bán thêm thì trigger guard_product_write ép về 'pending'.
alter table public.products
  add column shop_id     bigint references public.shops (id) default public.house_shop_id(),
  add column brand_id    bigint references public.brands (id),
  add column status      text not null default 'active'
                         check (status in ('pending', 'active', 'hidden')),
  add column approved_at timestamptz;

update public.products p
set brand_id = b.id
from public.brands b
where b.slug = public.slugify(p.brand);

update public.products set approved_at = created_at where approved_at is null;

alter table public.products alter column shop_id set not null;

create index products_shop_idx on public.products (shop_id);
create index products_brand_idx on public.products (brand_id);
create index products_status_idx on public.products (status);

-- Giữ brand (text) và brand_id khớp nhau:
-- - gửi brand_id (kênh người bán, Tuần 2) → chép tên sang brand
-- - chỉ gửi brand (form admin cũ, import-dataset.js) → tìm theo slug; admin/script thì tạo mới nếu chưa có.
--   Người bán gõ thương hiệu chưa có thì brand_id để trống (câu hỏi mở: người bán có được tạo thương hiệu?).
create or replace function public.sync_product_brand()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slug text;
  v_id   bigint;
begin
  if new.brand_id is not null
     and (tg_op = 'INSERT' or new.brand_id is distinct from old.brand_id) then
    select name into new.brand from public.brands where id = new.brand_id;
  elsif tg_op = 'INSERT' or new.brand is distinct from old.brand then
    v_slug := public.slugify(new.brand);
    if v_slug = '' then
      new.brand_id := null;
      return new;
    end if;
    select id into v_id from public.brands where slug = v_slug;
    if v_id is null and (public.is_admin() or auth.uid() is null) then
      insert into public.brands (name, slug) values (left(trim(new.brand), 60), v_slug) returning id into v_id;
    end if;
    new.brand_id := v_id;
  end if;
  return new;
end;
$$;

create trigger products_sync_brand
  before insert or update of brand, brand_id on public.products
  for each row execute function public.sync_product_brand();

-- Giới hạn của người bán khi ghi sản phẩm (RLS chỉ chặn theo dòng, không chặn theo giá trị cột):
-- - thêm mới luôn ở trạng thái chờ duyệt
-- - không tự duyệt: chỉ được 'active' lại sản phẩm admin đã duyệt trước đó (bỏ ẩn)
-- - không chuyển sản phẩm sang shop khác
-- Admin và script chạy bằng service role (auth.uid() null) không bị giới hạn.
-- Admin gỡ sản phẩm (đổi sang ẩn / chờ duyệt) thì xóa approved_at: người bán không tự bán lại được,
-- phải chờ admin duyệt lần nữa.
create or replace function public.guard_product_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() or auth.uid() is null then
    if new.status = 'active' and new.approved_at is null then
      new.approved_at := now();
    elsif tg_op = 'UPDATE' and new.status <> 'active' and new.status is distinct from old.status then
      new.approved_at := null;
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.approved_at := null;
    return new;
  end if;

  -- place_order / hủy đơn chạy với quyền của khách nhưng chỉ đổi tồn kho → không vướng các điều kiện dưới.
  if new.shop_id is distinct from old.shop_id then
    raise exception 'Không được chuyển sản phẩm sang shop khác';
  end if;
  new.approved_at := old.approved_at;
  if new.status = 'active' and old.status <> 'active' and old.approved_at is null then
    raise exception 'Sản phẩm cần admin duyệt trước khi bán';
  end if;
  return new;
end;
$$;

create trigger products_guard_write
  before insert or update on public.products
  for each row execute function public.guard_product_write();

-- Người bán đổi giá cũng phải ghi được lịch sử giá (bảng price_history chỉ admin ghi trực tiếp).
create or replace function public.log_price_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.price is distinct from old.price then
    insert into public.price_history (product_id, price) values (new.id, new.price);
  end if;
  return new;
end;
$$;

-- ---------- 5. RLS ----------

alter table public.shops  enable row level security;
alter table public.brands enable row level security;

-- Sản phẩm: khách thấy hàng đang bán của shop đang hoạt động; chủ shop thấy mọi sản phẩm của shop mình;
-- người đã mua vẫn thấy sản phẩm trong đơn của mình (để lịch sử đơn không mất tên, ảnh khi sản phẩm bị ẩn).
drop policy if exists "products_read" on public.products;
drop policy if exists "products_admin" on public.products;

create policy "products_read" on public.products for select using (
  (status = 'active' and public.shop_is_active(shop_id))
  or public.is_admin()
  or exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid())
  or exists (
    select 1
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where oi.product_id = products.id and o.user_id = auth.uid()
  )
);
create policy "products_insert" on public.products for insert
  with check (public.is_admin() or public.can_manage_shop(shop_id));
create policy "products_update" on public.products for update
  using (public.is_admin() or public.can_manage_shop(shop_id))
  with check (public.is_admin() or public.can_manage_shop(shop_id));
-- Người bán không xóa (sản phẩm có thể nằm trong đơn), chỉ ẩn.
create policy "products_delete" on public.products for delete using (public.is_admin());

-- Shop: ai cũng xem shop đang hoạt động; chủ shop xem shop của mình ở mọi trạng thái.
create policy "shops_read" on public.shops for select
  using (status = 'active' or owner_id = auth.uid() or public.is_admin());
-- Đăng ký mở shop: chỉ cho chính mình (trigger ép trạng thái chờ duyệt).
create policy "shops_insert" on public.shops for insert
  with check (owner_id = auth.uid() or public.is_admin());
create policy "shops_update" on public.shops for update
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());
create policy "shops_delete" on public.shops for delete using (public.is_admin());

-- Chủ shop chỉ sửa tên, mô tả, logo; duyệt / khóa / đổi chủ / đổi đường dẫn là việc của admin.
create or replace function public.guard_shop_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- house_shop_id() tìm shop HcmusWare theo slug (mặc định của products.shop_id) → không ai đổi được slug này.
  if tg_op = 'UPDATE' and old.slug = 'hcmusware' and new.slug is distinct from old.slug then
    raise exception 'Không đổi được đường dẫn của shop HcmusWare';
  end if;
  if public.is_admin() or auth.uid() is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.owner_id := auth.uid();
    new.status := 'pending';
    return new;
  end if;
  if new.status is distinct from old.status
     or new.owner_id is distinct from old.owner_id
     or new.slug is distinct from old.slug then
    raise exception 'Chỉ admin được đổi trạng thái, chủ sở hữu hoặc đường dẫn của shop';
  end if;
  return new;
end;
$$;

create trigger shops_guard_write
  before insert or update on public.shops
  for each row execute function public.guard_shop_write();

-- Thương hiệu: ai cũng xem, chỉ admin thêm/sửa/xóa.
create policy "brands_read"  on public.brands for select using (true);
create policy "brands_admin" on public.brands for all using (public.is_admin()) with check (public.is_admin());

-- ---------- 6. Quản lý người dùng (chỉ admin) ----------

-- Đổi vai trò. Không cho admin tự đổi vai trò của mình (tránh tự khóa mình khỏi trang admin).
create or replace function public.set_user_role(p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Chỉ admin được đổi vai trò người dùng';
  end if;
  if coalesce(p_role, '') not in ('customer', 'seller', 'admin') then
    raise exception 'Vai trò không hợp lệ';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Không thể tự đổi vai trò của chính mình';
  end if;
  update public.profiles set role = p_role where id = p_user_id;
  if not found then
    raise exception 'Không tìm thấy người dùng';
  end if;
end;
$$;

-- Danh sách người dùng kèm email (email nằm ở auth.users, frontend không đọc trực tiếp được).
create or replace function public.admin_list_users(p_search text default null, p_limit int default 50)
returns table (
  id          uuid,
  email       text,
  full_name   text,
  role        text,
  created_at  timestamptz,
  shop_name   text,
  shop_status text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_q text := lower(trim(coalesce(p_search, '')));
begin
  if not public.is_admin() then
    raise exception 'Chỉ admin được xem danh sách người dùng';
  end if;
  return query
    select p.id, u.email::text, p.full_name, p.role, p.created_at, s.name, s.status
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.shops s on s.owner_id = p.id
    where v_q = ''
       or strpos(lower(u.email), v_q) > 0
       or strpos(lower(coalesce(p.full_name, '')), v_q) > 0
    order by p.created_at desc
    limit least(greatest(coalesce(p_limit, 50), 1), 200);
end;
$$;

-- Supabase tự cấp quyền gọi hàm cho anon → thu hồi rõ ràng, chỉ người đã đăng nhập gọi được.
revoke execute on function public.set_user_role(uuid, text) from public, anon;
revoke execute on function public.admin_list_users(text, int) from public, anon;
grant execute on function public.set_user_role(uuid, text) to authenticated;
grant execute on function public.admin_list_users(text, int) to authenticated;

-- ---------- 7. Đặt hàng: chặn sản phẩm không được bán ----------
-- place_order chạy security definer (bỏ qua RLS) nên phải tự kiểm tra trạng thái.
-- Giữ nguyên phần còn lại của bản 20261023000000; tách đơn theo shop làm ở Tuần 3.
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
  v_order_id bigint;
  v_item     jsonb;
  v_line     record;
  v_product  public.products%rowtype;
  v_qty      int;
  v_total    bigint := 0;
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

  insert into public.orders (user_id, payment_method, shipping_name, shipping_phone, shipping_address, note)
  values (auth.uid(), p_payment_method, trim(p_shipping_name), trim(p_shipping_phone),
          trim(p_shipping_address), nullif(trim(p_note), ''))
  returning id into v_order_id;

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

    update public.products set stock = stock - v_line.qty where id = v_product.id;
    insert into public.order_items (order_id, product_id, quantity, unit_price)
    values (v_order_id, v_product.id, v_line.qty, v_product.price);
    v_total := v_total + v_product.price * v_line.qty;
  end loop;

  update public.orders set total = v_total where id = v_order_id;
  return v_order_id;
end;
$$;
