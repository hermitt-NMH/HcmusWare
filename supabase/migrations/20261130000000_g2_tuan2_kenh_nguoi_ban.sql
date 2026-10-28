-- =====================================================================
-- Giai đoạn 2 – Tuần 2: kênh người bán, duyệt shop / sản phẩm, ảnh sản phẩm (F14, F15).
-- Theo các quyết định C1–C4 trong docs/user-story-g2.md (mục "Đã chốt").
-- 1. shops: trạng thái 'rejected' + cột review_note (lý do từ chối). Chủ shop chỉ được gửi lại
--    rejected → pending. Duyệt / từ chối / khóa chỉ qua hàm approve_shop, reject_shop, set_shop_locked;
--    duyệt shop đồng thời cấp vai trò seller (C4). Admin xem danh sách shop kèm email (admin_list_shops).
-- 2. products: review_note (lý do trả lại), images (1–5 ảnh, ảnh đầu = image_url).
--    Tên sản phẩm chỉ cần không trùng trong cùng shop + danh mục (2 shop được bán cùng một mẫu).
--    Người bán đổi tên / danh mục / thương hiệu / thông số → về chờ duyệt (C3).
--    Không duyệt được sản phẩm chưa có thương hiệu trong danh sách (C1).
-- 3. brand_list(): danh sách thương hiệu kèm số sản phẩm đang bán (trang /thuong-hieu).
-- 4. Storage: bucket product-images (công khai để xem), ảnh ≤ 2 MB, chỉ JPG/PNG/WebP;
--    chủ shop chỉ ghi được vào thư mục <shop_id>/ của mình.
--
-- Online: chạy npm run db:backup TRƯỚC khi npx supabase db push.
-- Kiểm thử quyền: npm run test:rls (các ca T2-xx).
-- =====================================================================

-- ---------- 1. Shop ----------

alter table public.shops drop constraint if exists shops_status_check;
alter table public.shops
  add constraint shops_status_check check (status in ('pending', 'active', 'rejected', 'locked')),
  add column review_note text check (length(review_note) <= 500);

-- Chủ shop chỉ sửa tên, mô tả, logo; trạng thái do admin đổi qua các hàm bên dưới (C4).
-- Ngoại lệ duy nhất: shop bị từ chối thì chủ shop sửa rồi gửi lại (rejected → pending), lý do cũ bị xóa.
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
  -- Script chạy bằng service role (auth.uid() null) không bị giới hạn.
  if auth.uid() is null then
    return new;
  end if;

  if public.is_admin() then
    -- Cờ hcmusware.shop_review do approve_shop / reject_shop / set_shop_locked bật trong transaction của chúng.
    if tg_op = 'UPDATE' and new.status is distinct from old.status
       and coalesce(current_setting('hcmusware.shop_review', true), '') <> 'on' then
      raise exception 'Đổi trạng thái shop bằng nút Duyệt / Từ chối / Khóa trên trang admin';
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.owner_id := auth.uid();
    new.status := 'pending';
    new.review_note := null;
    return new;
  end if;

  if new.owner_id is distinct from old.owner_id then
    raise exception 'Chỉ admin được đổi chủ sở hữu shop';
  end if;
  -- Gửi lại sau khi bị từ chối: shop chưa từng hiện trên web nên được đổi cả đường dẫn theo tên mới.
  if old.status = 'rejected' and new.status = 'pending' then
    new.review_note := null;
    return new;
  end if;
  if new.status is distinct from old.status then
    raise exception 'Chỉ admin được đổi trạng thái shop';
  end if;
  if new.slug is distinct from old.slug and old.status not in ('pending', 'rejected') then
    raise exception 'Chỉ admin được đổi đường dẫn của shop đang hoạt động';
  end if;
  new.review_note := old.review_note;
  return new;
end;
$$;

-- Duyệt shop: shop → Hoạt động VÀ chủ shop → seller trong cùng một transaction (C4).
-- Chủ shop là admin (shop HcmusWare) thì giữ nguyên vai trò admin (C5).
create or replace function public.approve_shop(p_shop_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop public.shops%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Chỉ admin được duyệt shop';
  end if;
  select * into v_shop from public.shops where id = p_shop_id for update;
  if not found then
    raise exception 'Không tìm thấy shop';
  end if;
  if v_shop.status <> 'pending' then
    raise exception 'Shop không ở trạng thái chờ duyệt';
  end if;

  perform set_config('hcmusware.shop_review', 'on', true);
  update public.shops set status = 'active', review_note = null where id = p_shop_id;
  perform set_config('hcmusware.shop_review', 'off', true);

  update public.profiles set role = 'seller' where id = v_shop.owner_id and role = 'customer';
end;
$$;

create or replace function public.reject_shop(p_shop_id bigint, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_note text := trim(coalesce(p_note, ''));
begin
  if not public.is_admin() then
    raise exception 'Chỉ admin được từ chối shop';
  end if;
  if v_note = '' or length(v_note) > 500 then
    raise exception 'Lý do từ chối bắt buộc, tối đa 500 ký tự';
  end if;

  perform set_config('hcmusware.shop_review', 'on', true);
  update public.shops set status = 'rejected', review_note = v_note
  where id = p_shop_id and status = 'pending';
  if not found then
    raise exception 'Shop không ở trạng thái chờ duyệt';
  end if;
  perform set_config('hcmusware.shop_review', 'off', true);
end;
$$;

-- Khóa (p_locked = true) / mở khóa shop. Khóa → mọi sản phẩm của shop ẩn với khách
-- (products_read cần shop_is_active), người bán mất quyền ghi (can_manage_shop cần shop active).
create or replace function public.set_shop_locked(p_shop_id bigint, p_locked boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop public.shops%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Chỉ admin được khóa shop';
  end if;
  select * into v_shop from public.shops where id = p_shop_id for update;
  if not found then
    raise exception 'Không tìm thấy shop';
  end if;
  if v_shop.slug = 'hcmusware' then
    raise exception 'Không khóa được shop HcmusWare';
  end if;
  if p_locked and v_shop.status <> 'active' then
    raise exception 'Chỉ khóa được shop đang hoạt động';
  end if;
  if not p_locked and v_shop.status <> 'locked' then
    raise exception 'Shop không bị khóa';
  end if;

  perform set_config('hcmusware.shop_review', 'on', true);
  update public.shops set status = case when p_locked then 'locked' else 'active' end
  where id = p_shop_id;
  perform set_config('hcmusware.shop_review', 'off', true);
end;
$$;

-- Danh sách shop cho trang /admin/duyet, kèm email chủ shop (nằm ở auth.users) và số sản phẩm.
-- p_status null = mọi trạng thái. Chờ duyệt: cũ nhất lên trên; còn lại: mới nhất lên trên.
create or replace function public.admin_list_shops(p_status text default null)
returns table (
  id               bigint,
  name             text,
  slug             text,
  description      text,
  logo_url         text,
  status           text,
  review_note      text,
  created_at       timestamptz,
  owner_email      text,
  product_count    bigint,
  pending_products bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Chỉ admin được xem danh sách shop';
  end if;
  return query
    select s.id, s.name, s.slug, s.description, s.logo_url, s.status, s.review_note, s.created_at,
           u.email::text,
           (select count(*) from public.products p where p.shop_id = s.id),
           (select count(*) from public.products p where p.shop_id = s.id and p.status = 'pending')
    from public.shops s
    left join auth.users u on u.id = s.owner_id
    where p_status is null or s.status = p_status
    order by case when s.status = 'pending' then s.created_at end asc nulls last,
             s.created_at desc;
end;
$$;

revoke execute on function public.approve_shop(bigint) from public, anon;
revoke execute on function public.reject_shop(bigint, text) from public, anon;
revoke execute on function public.set_shop_locked(bigint, boolean) from public, anon;
revoke execute on function public.admin_list_shops(text) from public, anon;
grant execute on function public.approve_shop(bigint) to authenticated;
grant execute on function public.reject_shop(bigint, text) to authenticated;
grant execute on function public.set_shop_locked(bigint, boolean) to authenticated;
grant execute on function public.admin_list_shops(text) to authenticated;

-- ---------- 2. Sản phẩm ----------

alter table public.products
  add column review_note text check (length(review_note) <= 500),
  add column images      text[] not null default '{}' check (cardinality(images) <= 5);

-- Sản phẩm cũ chỉ có 1 ảnh → images = [image_url].
update public.products set images = array[image_url] where image_url is not null;

-- Trước: tên không trùng trong cả danh mục → shop thứ hai không đăng được "Ryzen 5 7600" mà HcmusWare đã bán.
alter table public.products drop constraint if exists products_category_id_name_key;
alter table public.products
  add constraint products_shop_category_name_key unique (shop_id, category_id, name);

-- Giới hạn khi ghi sản phẩm (RLS chỉ chặn theo dòng, không chặn theo giá trị cột).
-- Admin / script (service role):
--   - không duyệt được sản phẩm chưa có thương hiệu trong danh sách (C1)
--   - duyệt → ghi approved_at, xóa lý do trả lại; gỡ (đổi sang ẩn / chờ duyệt) → xóa approved_at
-- Người bán:
--   - thêm mới luôn chờ duyệt; không chuyển sản phẩm sang shop khác; không tự ghi review_note
--   - đổi tên / danh mục / thương hiệu / thông số → về chờ duyệt (C3)
--   - chỉ "hiện lại" sản phẩm admin đã duyệt và chưa gỡ (approved_at còn)
--   - gửi lại (→ pending) thì xóa lý do trả lại (C2)
-- place_order / hủy đơn chạy với quyền của khách nhưng chỉ đổi tồn kho → không vướng các điều kiện này.
create or replace function public.guard_product_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() or auth.uid() is null then
    if tg_op = 'UPDATE' and auth.uid() is not null
       and old.status = 'pending' and new.status = 'active' and new.brand_id is null then
      raise exception 'Chọn hoặc tạo thương hiệu trước khi duyệt sản phẩm';
    end if;
    if new.status = 'active' and new.approved_at is null then
      new.approved_at := now();
      new.review_note := null;
    elsif tg_op = 'UPDATE' and new.status <> 'active' and new.status is distinct from old.status then
      new.approved_at := null;
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.approved_at := null;
    new.review_note := null;
    return new;
  end if;

  if new.shop_id is distinct from old.shop_id then
    raise exception 'Không được chuyển sản phẩm sang shop khác';
  end if;
  new.approved_at := old.approved_at;
  new.review_note := old.review_note;

  if new.name is distinct from old.name
     or new.category_id is distinct from old.category_id
     or new.brand_id is distinct from old.brand_id
     or new.brand is distinct from old.brand
     or new.specs is distinct from old.specs then
    new.status := 'pending';
    new.approved_at := null;
  end if;

  if new.status = 'active' and old.status <> 'active' and new.approved_at is null then
    raise exception 'Sản phẩm cần admin duyệt trước khi bán';
  end if;
  if new.status = 'pending' and old.status <> 'pending' then
    new.review_note := null;
  end if;
  return new;
end;
$$;

-- Ảnh đại diện (image_url) luôn là ảnh đầu tiên của images, để ProductCard, giỏ hàng, Builder
-- (đang đọc image_url) không phải sửa. Form admin cũ chỉ gửi image_url → images = [image_url].
create or replace function public.sync_product_images()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.images is not distinct from old.images
     and new.image_url is distinct from old.image_url then
    new.images := case when new.image_url is null then '{}' else array[new.image_url] end;
  elsif tg_op = 'INSERT' and cardinality(new.images) = 0 and new.image_url is not null then
    new.images := array[new.image_url];
  end if;
  new.image_url := new.images[1];
  return new;
end;
$$;

create trigger products_sync_images
  before insert or update of images, image_url on public.products
  for each row execute function public.sync_product_images();

-- Duyệt / trả lại sản phẩm (trang /admin/duyet). Trả lại → ẩn, lưu lý do cho người bán (C2).
create or replace function public.approve_product(p_product_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Chỉ admin được duyệt sản phẩm';
  end if;
  -- guard_product_write kiểm tra thương hiệu (C1).
  update public.products set status = 'active' where id = p_product_id and status = 'pending';
  if not found then
    raise exception 'Sản phẩm không ở trạng thái chờ duyệt';
  end if;
end;
$$;

create or replace function public.reject_product(p_product_id bigint, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_note text := trim(coalesce(p_note, ''));
begin
  if not public.is_admin() then
    raise exception 'Chỉ admin được trả lại sản phẩm';
  end if;
  if v_note = '' or length(v_note) > 500 then
    raise exception 'Lý do trả lại bắt buộc, tối đa 500 ký tự';
  end if;
  update public.products set status = 'hidden', review_note = v_note
  where id = p_product_id and status = 'pending';
  if not found then
    raise exception 'Sản phẩm không ở trạng thái chờ duyệt';
  end if;
end;
$$;

revoke execute on function public.approve_product(bigint) from public, anon;
revoke execute on function public.reject_product(bigint, text) from public, anon;
grant execute on function public.approve_product(bigint) to authenticated;
grant execute on function public.reject_product(bigint, text) to authenticated;

-- ---------- 3. Thương hiệu ----------

-- Đếm sản phẩm ĐANG BÁN (sản phẩm active của shop active) cho mọi người như nhau.
-- Không đếm qua RLS vì admin / chủ shop đọc được cả hàng chờ duyệt → số sẽ khác khách.
create or replace function public.brand_list()
returns table (id bigint, name text, slug text, logo_url text, product_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select b.id, b.name, b.slug, b.logo_url,
         count(p.id) filter (where p.status = 'active' and s.status = 'active')
  from public.brands b
  left join public.products p on p.brand_id = b.id
  left join public.shops s on s.id = p.shop_id
  group by b.id
  order by b.name;
$$;

-- ---------- 4. Ảnh sản phẩm (Storage) ----------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 2097152,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Đường dẫn ảnh dạng "<shop_id>/<tên file>". Ghi được khi: là admin, hoặc là chủ của shop đó
-- và shop chưa bị khóa (shop chờ duyệt / bị từ chối vẫn cần tải logo lúc đăng ký).
create or replace function public.can_write_shop_folder(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or exists (
    select 1
    from public.shops s
    where s.id::text = (storage.foldername(p_name))[1]
      and s.owner_id = auth.uid()
      and s.status <> 'locked'
  );
$$;

create policy "product_images_read" on storage.objects for select
  using (bucket_id = 'product-images');
create policy "product_images_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.can_write_shop_folder(name));
create policy "product_images_update" on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.can_write_shop_folder(name))
  with check (bucket_id = 'product-images' and public.can_write_shop_folder(name));
create policy "product_images_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.can_write_shop_folder(name));
