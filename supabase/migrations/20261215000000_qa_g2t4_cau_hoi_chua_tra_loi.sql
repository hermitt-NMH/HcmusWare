-- =====================================================================
-- Sửa lỗi QA G2T4 (BUG-G2T4-02): "Câu hỏi chưa trả lời" trong kênh người bán còn liệt kê câu hỏi
-- của sản phẩm đã ẩn / chờ duyệt. Người bán bấm trả lời thì guard_comment_write báo
-- "Sản phẩm không tồn tại hoặc đã ngừng bán", link sang trang sản phẩm cũng ra 404.
-- → Chỉ lấy câu hỏi trên sản phẩm đang bán (cùng điều kiện guard_comment_write cho phép trả lời).
-- Sản phẩm bán lại (active) thì câu hỏi tự hiện lại trong danh sách.
-- Online: chạy npm run db:backup TRƯỚC khi npx supabase db push.
-- Kiểm thử: npm run test:rls (ca T4-07).
-- =====================================================================

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
    and p.status = 'active'
    and c.parent_id is null
    and not c.hidden
    and not exists (
      select 1 from public.comments r
      where r.parent_id = c.id and r.is_seller and not r.hidden
    )
  order by c.created_at desc, c.id desc
  limit 100;
$$;
