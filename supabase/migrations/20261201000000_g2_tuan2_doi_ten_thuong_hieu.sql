-- =====================================================================
-- Giai đoạn 2 – Tuần 2: admin đổi tên thương hiệu (US-15.6, BUG-G2T2-03).
-- products.brand (chữ) là bản sao tên thương hiệu, bộ lọc / tìm kiếm / giỏ hàng đọc cột này.
-- Đổi brands.name thì chép tên mới sang mọi sản phẩm của thương hiệu đó, trong cùng transaction.
--
-- Vì sao không làm từ frontend: sync_product_brand thấy products.brand đổi thì tìm lại brand_id
-- theo slugify(brand), mà slugify trong DB không bỏ dấu ("Ánh" → "nh") → không thấy → admin
-- sẽ TẠO NHẦM một thương hiệu mới. Nên thêm nhánh: brand_id giữ nguyên và chữ mới đúng bằng
-- tên hiện tại của thương hiệu đó → chỉ là đồng bộ tên, không tìm lại.
--
-- Online: chạy npm run db:backup TRƯỚC khi npx supabase db push.
-- =====================================================================

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
  -- Đồng bộ tên sau khi admin đổi tên thương hiệu (trigger brands_sync_name bên dưới).
  if tg_op = 'UPDATE' and new.brand_id is not null
     and new.brand_id is not distinct from old.brand_id
     and new.brand = (select name from public.brands where id = new.brand_id) then
    return new;
  end if;

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

create or replace function public.sync_brand_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.products
  set brand = new.name
  where brand_id = new.id and brand is distinct from new.name;
  return null;
end;
$$;

create trigger brands_sync_name
  after update of name on public.brands
  for each row
  when (new.name is distinct from old.name)
  execute function public.sync_brand_name();
