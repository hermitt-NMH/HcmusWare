-- =====================================================================
-- BUG-01: policy cũ "saved_builds_read ... using (true)" cho phép bất kỳ ai
-- (kể cả anon) liệt kê toàn bộ cấu hình đã lưu, lộ user_id và share_code.
-- Sửa: chỉ chủ sở hữu được select trực tiếp bảng; người có link chia sẻ
-- xem cấu hình qua hàm get_build_by_share_code (phải biết đúng mã).
-- Các policy insert/update/delete của chủ sở hữu giữ nguyên.
-- =====================================================================

drop policy if exists "saved_builds_read" on public.saved_builds;

create policy "saved_builds_read_own" on public.saved_builds
  for select using (user_id = auth.uid());

-- Lấy một cấu hình theo share_code (dùng cho trang xem link chia sẻ).
-- security definer để bỏ qua RLS, nhưng chỉ trả đúng 1 dòng khớp mã
-- và KHÔNG trả user_id.
-- Gọi từ JS: supabase.rpc('get_build_by_share_code', { code: 'abc12345' })
create or replace function public.get_build_by_share_code(code text)
returns table (
  id          bigint,
  name        text,
  items       jsonb,
  share_code  text,
  created_at  timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select b.id, b.name, b.items, b.share_code, b.created_at
  from public.saved_builds b
  where b.share_code = code
  limit 1;
$$;

revoke execute on function public.get_build_by_share_code(text) from public;
grant execute on function public.get_build_by_share_code(text) to anon, authenticated;
