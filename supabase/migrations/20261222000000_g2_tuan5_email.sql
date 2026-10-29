-- =====================================================================
-- Giai đoạn 2 – Tuần 5: email thông báo (F12 – US-12.3), làm sau thông báo trong web (20261221000000).
-- 1. profiles: công tắc email cho từng loại (giá, đơn hàng), mặc định bật; email_token để tắt email
--    từ link cuối thư mà không cần đăng nhập (unsubscribe_email).
-- 2. notifications: email_status (pending → sending → sent | failed | skipped), email_error, emailed_at.
--    Thông báo cần gửi email được đánh dấu pending ngay lúc tạo (add_notification, p_email = true):
--    giá xuống tới giá mong muốn; đơn chuyển Đang giao / Hoàn tất / Đã hủy. Công tắc đang tắt thì không gửi.
-- 3. Trigger sau khi thêm thông báo pending → pg_net gọi Edge Function send-email (bất đồng bộ, chạy sau commit).
--    Mọi lỗi (chưa cấu hình, lỗi mạng, hết hạn mức) chỉ ghi vào email_status/email_error,
--    KHÔNG làm hỏng việc đổi trạng thái đơn và không chặn thông báo trong web.
--    Gửi đúng 1 lần: trigger chỉ chạy lúc INSERT; Edge Function "nhận việc" bằng
--    update ... where email_status = 'pending' nên gọi lặp cũng không gửi lần 2.
--
-- Cấu hình (KHÔNG nằm trong repo): xem supabase/functions/send-email/README.md.
--   select vault.create_secret('<url>/functions/v1/send-email', 'email_function_url');
--   select vault.create_secret('<chuỗi ngẫu nhiên>', 'email_hook_secret');
-- Chưa cấu hình thì thông báo trong web vẫn chạy, email ghi skipped.
--
-- Online: chạy npm run db:backup TRƯỚC khi npx supabase db push.
-- Kiểm thử quyền: npm run test:rls (các ca T5-08 … T5-10).
-- =====================================================================

create extension if not exists pg_net with schema extensions;

-- ---------- 1. Công tắc email ----------

alter table public.profiles
  add column email_price_alerts boolean not null default true,
  add column email_order_status boolean not null default true,
  add column email_token uuid not null default gen_random_uuid();
create unique index profiles_email_token_idx on public.profiles (email_token);

-- Người dùng tự bật/tắt 2 công tắc của mình (profiles_update_own đã giới hạn dòng của chính mình).
grant update (email_price_alerts, email_order_status) on public.profiles to authenticated;

-- Link "tắt email" cuối thư: không cần đăng nhập, chỉ cần token (UUID ngẫu nhiên của từng người).
-- p_kind: 'gia' (cảnh báo giá) | 'don' (trạng thái đơn). Token sai → false, không lộ gì.
create or replace function public.unsubscribe_email(p_token uuid, p_kind text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_kind not in ('gia', 'don') then
    raise exception 'Loại email không hợp lệ';
  end if;
  update public.profiles
  set email_price_alerts = case when p_kind = 'gia' then false else email_price_alerts end,
      email_order_status = case when p_kind = 'don' then false else email_order_status end
  where email_token = p_token;
  return found;
end;
$$;

revoke execute on function public.unsubscribe_email(uuid, text) from public;
grant execute on function public.unsubscribe_email(uuid, text) to anon, authenticated;

-- ---------- 2. Trạng thái gửi email của thông báo ----------

alter table public.notifications
  add column email_status text check (email_status in ('pending', 'sending', 'sent', 'failed', 'skipped')),
  add column email_error  text,
  add column emailed_at   timestamptz;

-- Thêm tham số p_email (mặc định false) → các trigger cũ gọi 5 tham số vẫn chạy.
drop function public.add_notification(uuid, text, text, text, text);
create or replace function public.add_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_link text,
  p_email boolean default false
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.notifications (user_id, type, title, body, link, email_status)
  select p_user_id, p_type, p_title, coalesce(p_body, ''), p_link,
         case when p_email and (
                (p_type = 'price_drop' and pr.email_price_alerts)
                or (p_type = 'order_status' and pr.email_order_status)
              ) then 'pending' end
  from (select 1) x
  left join public.profiles pr on pr.id = p_user_id
  where p_user_id is not null;
$$;

revoke execute on function public.add_notification(uuid, text, text, text, text, boolean)
  from public, anon, authenticated;

-- Giữ nguyên bản 20261221000000, chỉ thêm p_email = true.
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
      '/san-pham/' || p_product_id,
      true
    );
  end loop;
end;
$$;

-- Email chỉ khi Đang giao / Hoàn tất / Đã hủy (US-12.3); Đã xác nhận chỉ báo trong web.
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
      '/don-hang/' || new.id,
      new.status in ('shipping', 'completed', 'cancelled')
    );
  end if;
  return null;
end;
$$;

-- ---------- 3. Gọi Edge Function ----------

create or replace function public.notifications_request_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url    text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'email_function_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'email_hook_secret';
  if v_url is null or v_secret is null then
    update public.notifications
    set email_status = 'skipped', email_error = 'Chưa cấu hình gửi email (vault)'
    where id = new.id;
    return null;
  end if;

  -- pg_net chỉ xếp hàng yêu cầu, gửi sau khi transaction commit; rollback thì không gửi.
  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('notification_id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook-secret', v_secret),
    timeout_milliseconds := 10000
  );
  return null;
exception when others then
  -- Không để lỗi gửi email làm hỏng việc tạo thông báo / đổi trạng thái đơn.
  update public.notifications
  set email_status = 'failed', email_error = left(sqlerrm, 500)
  where id = new.id;
  return null;
end;
$$;

create trigger notifications_request_email
  after insert on public.notifications
  for each row
  when (new.email_status = 'pending')
  execute function public.notifications_request_email();
