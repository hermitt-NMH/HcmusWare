-- =====================================================================
-- PC Parts Web – schema ban đầu (bảng, hàm, RLS)
-- Local:  npm run db:start / npm run db:reset tự chạy file này rồi chạy seed.sql
-- Online: npx supabase db push (sau khi supabase link) – xem README
-- Muốn đổi schema: tạo migration mới bằng  npx supabase migration new <ten>
-- =====================================================================

-- ---------- Bảng ----------

create table public.categories (
  id          serial primary key,
  name        text not null,
  slug        text not null unique,          -- cpu, mainboard, ram, vga, ssd, psu, case, cooler
  sort_order  int  not null default 0
);

create table public.products (
  id             bigint generated always as identity primary key,
  category_id    int    not null references public.categories (id),
  name           text   not null,
  brand          text,
  price          bigint not null check (price >= 0),   -- VNĐ
  stock          int    not null default 0 check (stock >= 0),
  image_url      text,
  datasheet_url  text,
  description    text,
  -- Thông số cho Builder, ví dụ:
  -- cpu:       { socket, tdp_w, cores, threads, base_clock_ghz, boost_clock_ghz, igpu }
  -- mainboard: { socket, ram_type, form_factor, ram_slots, max_ram_gb }
  -- ram:       { ram_type, speed_mhz, modules, capacity_gb }
  -- vga:       { chipset, vram_gb, length_mm, tdp_w }
  -- ssd:       { capacity_gb, interface, form_factor }
  -- psu:       { wattage_w, efficiency, form_factor, modular }
  -- case:      { case_type, form_factors[], max_gpu_length_mm }
  -- cooler:    { sockets[], radiator_mm, max_tdp_w }
  specs          jsonb  not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  unique (category_id, name)
);
create index products_category_idx on public.products (category_id);
create index products_specs_idx on public.products using gin (specs);

create table public.price_history (
  id           bigint generated always as identity primary key,
  product_id   bigint not null references public.products (id) on delete cascade,
  price        bigint not null check (price >= 0),
  recorded_at  timestamptz not null default now()
);
create index price_history_product_idx on public.price_history (product_id, recorded_at);

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  phone       text,
  address     text,
  role        text not null default 'customer' check (role in ('customer', 'admin')),
  created_at  timestamptz not null default now()
);

create table public.orders (
  id              bigint generated always as identity primary key,
  user_id         uuid   not null references auth.users (id),
  status          text   not null default 'pending'
                  check (status in ('pending', 'confirmed', 'shipping', 'completed', 'cancelled')),
  payment_method  text   not null default 'cod' check (payment_method in ('cod', 'mock_online')),
  total           bigint not null default 0 check (total >= 0),
  shipping_name   text   not null,
  shipping_phone  text   not null,
  shipping_address text  not null,
  note            text,
  created_at      timestamptz not null default now()
);
create index orders_user_idx on public.orders (user_id, created_at desc);

create table public.order_items (
  id          bigint generated always as identity primary key,
  order_id    bigint not null references public.orders (id) on delete cascade,
  product_id  bigint not null references public.products (id),
  quantity    int    not null check (quantity > 0),
  unit_price  bigint not null check (unit_price >= 0)   -- giá lúc mua
);
create index order_items_order_idx on public.order_items (order_id);

create table public.saved_builds (
  id          bigint generated always as identity primary key,
  user_id     uuid  not null references auth.users (id) on delete cascade,
  name        text  not null,
  items       jsonb not null default '{}'::jsonb,   -- { "cpu": 12, "mainboard": 34, ... }
  share_code  text  not null unique default substr(md5(random()::text), 1, 8),
  created_at  timestamptz not null default now()
);

create table public.price_alerts (
  id            bigint generated always as identity primary key,
  user_id       uuid   not null references auth.users (id) on delete cascade,
  product_id    bigint not null references public.products (id) on delete cascade,
  target_price  bigint not null check (target_price > 0),
  notified      boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (user_id, product_id)
);

create table public.reviews (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  product_id  bigint not null references public.products (id) on delete cascade,
  rating      int  not null check (rating between 1 and 5),
  comment     text,
  created_at  timestamptz not null default now(),
  unique (user_id, product_id)
);

-- ---------- Hàm tiện ích ----------

-- Kiểm tra người đang đăng nhập có phải admin không.
-- security definer để policy của profiles không tự gọi lại chính nó (đệ quy).
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Tự tạo profile khi có người đăng ký (email hoặc Google).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Đổi giá sản phẩm thì tự ghi vào price_history.
create or replace function public.log_price_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' or new.price is distinct from old.price then
    insert into public.price_history (product_id, price) values (new.id, new.price);
  end if;
  return new;
end;
$$;

create trigger products_price_history
  after insert or update of price on public.products
  for each row execute function public.log_price_change();

-- Đặt hàng: giá và tổng tiền lấy từ DB (không tin giá do trình duyệt gửi lên),
-- trừ tồn kho trong cùng một giao dịch.
-- p_items: [{ "product_id": 1, "quantity": 2 }, ...]
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
  v_product  public.products%rowtype;
  v_qty      int;
  v_total    bigint := 0;
begin
  if auth.uid() is null then
    raise exception 'Bạn cần đăng nhập để đặt hàng';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Giỏ hàng trống';
  end if;

  insert into public.orders (user_id, payment_method, shipping_name, shipping_phone, shipping_address, note)
  values (auth.uid(), p_payment_method, p_shipping_name, p_shipping_phone, p_shipping_address, p_note)
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item ->> 'quantity')::int;
    if v_qty is null or v_qty <= 0 then
      raise exception 'Số lượng không hợp lệ';
    end if;

    select * into v_product from public.products
    where id = (v_item ->> 'product_id')::bigint
    for update;

    if not found then
      raise exception 'Sản phẩm % không tồn tại', v_item ->> 'product_id';
    end if;
    if v_product.stock < v_qty then
      raise exception 'Sản phẩm "%" chỉ còn % chiếc', v_product.name, v_product.stock;
    end if;

    update public.products set stock = stock - v_qty where id = v_product.id;
    insert into public.order_items (order_id, product_id, quantity, unit_price)
    values (v_order_id, v_product.id, v_qty, v_product.price);
    v_total := v_total + v_product.price * v_qty;
  end loop;

  update public.orders set total = v_total where id = v_order_id;
  return v_order_id;
end;
$$;

-- ---------- Row Level Security ----------

alter table public.categories    enable row level security;
alter table public.products      enable row level security;
alter table public.price_history enable row level security;
alter table public.profiles      enable row level security;
alter table public.orders        enable row level security;
alter table public.order_items   enable row level security;
alter table public.saved_builds  enable row level security;
alter table public.price_alerts  enable row level security;
alter table public.reviews       enable row level security;

-- Danh mục, sản phẩm, lịch sử giá: ai cũng xem được, chỉ admin sửa.
create policy "categories_read"  on public.categories for select using (true);
create policy "categories_admin" on public.categories for all using (public.is_admin()) with check (public.is_admin());

create policy "products_read"  on public.products for select using (true);
create policy "products_admin" on public.products for all using (public.is_admin()) with check (public.is_admin());

create policy "price_history_read"  on public.price_history for select using (true);
create policy "price_history_admin" on public.price_history for all using (public.is_admin()) with check (public.is_admin());

-- Hồ sơ: tự xem/sửa của mình; admin xem tất cả.
create policy "profiles_read_own"   on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "profiles_update_own" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
-- Người dùng không tự nâng mình lên admin được: chỉ cho sửa 3 cột này.
revoke update on public.profiles from authenticated, anon;
grant update (full_name, phone, address) on public.profiles to authenticated;

-- Đơn hàng: tạo qua hàm place_order; khách xem đơn của mình; admin xem và đổi trạng thái.
create policy "orders_read"         on public.orders for select using (user_id = auth.uid() or public.is_admin());
create policy "orders_admin_update" on public.orders for update using (public.is_admin()) with check (public.is_admin());

create policy "order_items_read" on public.order_items for select using (
  public.is_admin()
  or exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
);

-- Cấu hình đã lưu: ai có link (share_code) đều xem được; chỉ chủ sở hữu sửa/xóa.
create policy "saved_builds_read"   on public.saved_builds for select using (true);
create policy "saved_builds_insert" on public.saved_builds for insert with check (user_id = auth.uid());
create policy "saved_builds_update" on public.saved_builds for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "saved_builds_delete" on public.saved_builds for delete using (user_id = auth.uid());

-- Cảnh báo giá: chỉ của riêng mình.
create policy "price_alerts_own" on public.price_alerts for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Đánh giá: ai cũng đọc được; tự viết/sửa/xóa của mình.
create policy "reviews_read"   on public.reviews for select using (true);
create policy "reviews_insert" on public.reviews for insert with check (user_id = auth.uid());
create policy "reviews_update" on public.reviews for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "reviews_delete" on public.reviews for delete using (user_id = auth.uid() or public.is_admin());
