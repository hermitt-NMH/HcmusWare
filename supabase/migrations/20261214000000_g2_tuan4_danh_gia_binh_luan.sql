-- =====================================================================
-- Giai đoạn 2 – Tuần 4: đánh giá và bình luận (F16 – US-16.1 … US-16.5).
-- 1. Hàm dùng chung: short_name (tên rút gọn "Nguyễn V. A."), clean_ugc (gộp dòng trống),
--    can_review (đã có đơn Hoàn tất chứa sản phẩm).
-- 2. reviews (đã có): chặn trong DB người chưa nhận hàng và đánh giá lần 2 (báo lỗi dễ hiểu),
--    thêm hidden, author_name, updated_at. Người viết chỉ ghi được rating, comment.
-- 3. product_ratings (mới): điểm trung bình + số lượt của từng sản phẩm, trigger tự cập nhật,
--    không tính đánh giá bị ẩn. ProductCard nhúng thẳng trong truy vấn sản phẩm.
--    shop_rating(): điểm trung bình của cả shop (trang /shop/:slug).
-- 4. comments (mới): hỏi đáp trên trang sản phẩm. Câu hỏi + 1 cấp trả lời.
--    Nhãn "Người bán" (is_seller) chỉ chủ shop đang hoạt động gắn được, trên sản phẩm của shop mình
--    (admin gắn được trên sản phẩm shop HcmusWare – C5).
-- 5. Ẩn / hiện lại: chỉ admin, qua set_review_hidden / set_comment_hidden. Ẩn câu hỏi thì ẩn luôn trả lời.
-- 6. seller_unanswered_questions(): mục "Câu hỏi chưa trả lời" trong kênh người bán.
--
-- profiles không cho đọc công khai nên tên người viết được chép (đã rút gọn) vào author_name lúc ghi.
-- Online: chạy npm run db:backup TRƯỚC khi npx supabase db push.
-- Kiểm thử quyền: npm run test:rls (các ca T4-xx).
-- =====================================================================

-- ---------- 1. Hàm dùng chung ----------

-- "Nguyễn Văn An" → "Nguyễn V. A."; một chữ thì giữ nguyên; trống → "Khách hàng".
create or replace function public.short_name(p_full text)
returns text
language sql
immutable
as $$
  select case
    when coalesce(trim(p_full), '') = '' then 'Khách hàng'
    else (
      select string_agg(case when i = 1 then w else upper(left(w, 1)) || '.' end, ' ' order by i)
      from unnest(regexp_split_to_array(trim(p_full), '\s+')) with ordinality as t(w, i)
    )
  end;
$$;

-- Nội dung người dùng gõ: bỏ \r, nhiều dòng trống liên tiếp gộp còn 1 dòng trống, bỏ khoảng trắng 2 đầu.
-- Cùng quy tắc với cleanText (src/features/reviews/reviews.js).
create or replace function public.clean_ugc(p_text text)
returns text
language sql
immutable
as $$
  select btrim(regexp_replace(replace(coalesce(p_text, ''), E'\r', ''), E'\\n\\s*\\n', E'\n\n', 'g'), E' \t\n');
$$;

-- Người đang đăng nhập đã nhận hàng (đơn Hoàn tất) có sản phẩm này chưa. Frontend gọi để hiện form.
create or replace function public.can_review(p_product_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.orders o
    join public.order_items oi on oi.order_id = o.id
    where o.user_id = auth.uid() and o.status = 'completed' and oi.product_id = p_product_id
  );
$$;

-- ---------- 2. Đánh giá ----------

alter table public.reviews
  alter column user_id set default auth.uid(),
  add column hidden      boolean not null default false,
  add column author_name text not null default 'Khách hàng',
  add column updated_at  timestamptz,
  add constraint reviews_comment_length check (length(comment) <= 1000);

create index reviews_product_idx on public.reviews (product_id, created_at desc);

-- Chạy trước kiểm tra RLS → báo lỗi tiếng Việt thay cho "violates row-level security policy".
-- auth.uid() null = script chạy bằng service role (seed, e2e): không chặn.
create or replace function public.guard_review_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.comment := nullif(public.clean_ugc(new.comment), '');

  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.user_id := auth.uid();
      if not public.can_review(new.product_id) then
        raise exception 'Chỉ người đã nhận hàng mới đánh giá được';
      end if;
      if exists (
        select 1 from public.reviews where user_id = new.user_id and product_id = new.product_id
      ) then
        raise exception 'Bạn đã đánh giá sản phẩm này, hãy sửa đánh giá cũ';
      end if;
      new.hidden := false;
    end if;
    new.author_name := public.short_name((select full_name from public.profiles where id = new.user_id));
  elsif new.rating is distinct from old.rating or new.comment is distinct from old.comment then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create trigger reviews_guard_write
  before insert or update on public.reviews
  for each row execute function public.guard_review_write();

drop policy if exists "reviews_read" on public.reviews;
drop policy if exists "reviews_insert" on public.reviews;
drop policy if exists "reviews_update" on public.reviews;
drop policy if exists "reviews_delete" on public.reviews;

-- Người viết vẫn thấy đánh giá của mình khi bị ẩn (để biết vì sao không còn trên trang).
create policy "reviews_read" on public.reviews for select
  using (not hidden or user_id = auth.uid() or public.is_admin());
create policy "reviews_insert" on public.reviews for insert
  with check (user_id = auth.uid() and public.can_review(product_id));
create policy "reviews_update" on public.reviews for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Không cho người viết tự xóa: xóa rồi viết lại sẽ lách được việc admin ẩn.
create policy "reviews_delete" on public.reviews for delete using (public.is_admin());

-- Chỉ ghi được số sao và nhận xét; hidden, user_id, product_id, author_name do DB quyết định.
revoke insert, update, delete on public.reviews from anon;
revoke insert, update on public.reviews from authenticated;
grant insert (product_id, rating, comment) on public.reviews to authenticated;
grant update (rating, comment) on public.reviews to authenticated;

-- ---------- 3. Điểm trung bình ----------

create table public.product_ratings (
  product_id    bigint primary key references public.products (id) on delete cascade,
  rating_avg    numeric(2, 1) not null,
  rating_count  int not null check (rating_count > 0)
);

alter table public.product_ratings enable row level security;
create policy "product_ratings_read" on public.product_ratings for select using (true);
revoke insert, update, delete on public.product_ratings from anon, authenticated;

create or replace function public.refresh_product_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product bigint := coalesce(new.product_id, old.product_id);
  v_avg     numeric;
  v_count   int;
begin
  select round(avg(rating), 1), count(*) into v_avg, v_count
  from public.reviews
  where product_id = v_product and not hidden;

  if v_count = 0 then
    delete from public.product_ratings where product_id = v_product;
  else
    insert into public.product_ratings (product_id, rating_avg, rating_count)
    values (v_product, v_avg, v_count)
    on conflict (product_id) do update
      set rating_avg = excluded.rating_avg, rating_count = excluded.rating_count;
  end if;
  return null;
end;
$$;

create trigger reviews_refresh_rating
  after insert or update or delete on public.reviews
  for each row execute function public.refresh_product_rating();

insert into public.product_ratings (product_id, rating_avg, rating_count)
select product_id, round(avg(rating), 1), count(*)
from public.reviews
where not hidden
group by product_id;

-- Điểm của shop = trung bình mọi đánh giá (không ẩn) trên sản phẩm của shop. Chưa có thì rating_count = 0.
create or replace function public.shop_rating(p_shop_id bigint)
returns table (rating_avg numeric, rating_count int)
language sql
stable
security definer
set search_path = public
as $$
  select round(avg(r.rating), 1), count(*)::int
  from public.reviews r
  join public.products p on p.id = r.product_id
  where p.shop_id = p_shop_id and not r.hidden;
$$;

-- ---------- 4. Hỏi đáp ----------

create table public.comments (
  id           bigint generated always as identity primary key,
  product_id   bigint not null references public.products (id) on delete cascade,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  parent_id    bigint references public.comments (id) on delete cascade,
  body         text not null check (length(body) between 1 and 1000),
  is_seller    boolean not null default false,
  author_name  text not null default 'Khách hàng',
  hidden       boolean not null default false,
  created_at   timestamptz not null default now()
);
create index comments_product_idx on public.comments (product_id, created_at desc) where parent_id is null;
create index comments_parent_idx on public.comments (parent_id);

create or replace function public.guard_comment_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.products%rowtype;
  v_parent  public.comments%rowtype;
begin
  if auth.uid() is not null then
    new.user_id := auth.uid();
    new.hidden := false;
  end if;

  new.body := public.clean_ugc(new.body);
  if new.body = '' then
    raise exception 'Nội dung không được để trống';
  end if;
  if length(new.body) > 1000 then
    raise exception 'Nội dung tối đa 1000 ký tự';
  end if;

  select * into v_product from public.products where id = new.product_id;
  if not found or v_product.status <> 'active' or not public.shop_is_active(v_product.shop_id) then
    raise exception 'Sản phẩm không tồn tại hoặc đã ngừng bán';
  end if;

  if new.parent_id is not null then
    select * into v_parent from public.comments where id = new.parent_id;
    -- Chỉ 1 cấp trả lời: trả lời phải gắn vào câu hỏi (không có parent) của cùng sản phẩm.
    if not found or v_parent.parent_id is not null or v_parent.product_id <> new.product_id
       or v_parent.hidden then
      raise exception 'Chỉ trả lời được câu hỏi đang hiển thị của sản phẩm này';
    end if;
  end if;

  if new.is_seller then
    if new.parent_id is null then
      raise exception 'Người bán chỉ gắn nhãn khi trả lời câu hỏi';
    end if;
    if auth.uid() is not null
       and not public.can_manage_shop(v_product.shop_id)
       and not (public.is_admin() and v_product.shop_id = public.house_shop_id()) then
      raise exception 'Chỉ người bán của shop này mới trả lời với nhãn Người bán';
    end if;
    new.author_name := (select name from public.shops where id = v_product.shop_id);
  else
    new.author_name := public.short_name((select full_name from public.profiles where id = new.user_id));
  end if;
  return new;
end;
$$;

create trigger comments_guard_write
  before insert on public.comments
  for each row execute function public.guard_comment_write();

-- Câu trả lời bị ẩn theo câu hỏi. security definer: đọc được câu hỏi đã ẩn mà không gọi lại policy.
create or replace function public.comment_is_hidden(p_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select hidden from public.comments where id = p_id), false);
$$;

alter table public.comments enable row level security;
create policy "comments_read" on public.comments for select
  using (public.is_admin() or (not hidden and not public.comment_is_hidden(parent_id)));
create policy "comments_insert" on public.comments for insert to authenticated
  with check (user_id = auth.uid());
create policy "comments_delete" on public.comments for delete using (public.is_admin());

-- Không ai sửa được bình luận (kể cả người viết); hidden chỉ đổi qua set_comment_hidden.
revoke insert, update, delete on public.comments from anon;
revoke insert, update on public.comments from authenticated;
grant insert (product_id, parent_id, body, is_seller) on public.comments to authenticated;

-- ---------- 5. Admin ẩn / hiện lại ----------

create or replace function public.set_review_hidden(p_id bigint, p_hidden boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Chỉ admin được ẩn hoặc hiện đánh giá';
  end if;
  update public.reviews set hidden = p_hidden where id = p_id;
  if not found then
    raise exception 'Không tìm thấy đánh giá';
  end if;
end;
$$;

create or replace function public.set_comment_hidden(p_id bigint, p_hidden boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Chỉ admin được ẩn hoặc hiện bình luận';
  end if;
  update public.comments set hidden = p_hidden where id = p_id;
  if not found then
    raise exception 'Không tìm thấy bình luận';
  end if;
end;
$$;

-- ---------- 6. Kênh người bán: câu hỏi chưa trả lời ----------
-- Câu hỏi đang hiện trên sản phẩm của shop mình mà chưa có câu trả lời nhãn "Người bán" (đang hiện).
create or replace function public.seller_unanswered_questions()
returns table (
  id           bigint,
  product_id   bigint,
  product_name text,
  body         text,
  author_name  text,
  created_at   timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.product_id, p.name, c.body, c.author_name, c.created_at
  from public.comments c
  join public.products p on p.id = c.product_id
  join public.shops s on s.id = p.shop_id
  where s.owner_id = auth.uid()
    and c.parent_id is null
    and not c.hidden
    and not exists (
      select 1 from public.comments r
      where r.parent_id = c.id and r.is_seller and not r.hidden
    )
  order by c.created_at desc, c.id desc
  limit 100;
$$;

revoke execute on function public.can_review(bigint) from public, anon;
revoke execute on function public.set_review_hidden(bigint, boolean) from public, anon;
revoke execute on function public.set_comment_hidden(bigint, boolean) from public, anon;
revoke execute on function public.seller_unanswered_questions() from public, anon;
grant execute on function public.can_review(bigint) to authenticated;
grant execute on function public.set_review_hidden(bigint, boolean) to authenticated;
grant execute on function public.set_comment_hidden(bigint, boolean) to authenticated;
grant execute on function public.seller_unanswered_questions() to authenticated;
grant execute on function public.shop_rating(bigint) to anon, authenticated;
