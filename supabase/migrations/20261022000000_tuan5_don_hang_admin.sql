-- =====================================================================
-- Tuần 5: thanh toán mô phỏng, trạng thái đơn hàng, trang admin.
-- 1. orders.paid_at: thời điểm khách thanh toán (online mô phỏng). COD thì null đến khi giao xong.
-- 2. place_order: kiểm tra thông tin giao hàng, phương thức thanh toán.
-- 3. mock_pay_order: khách bấm "Thanh toán" ở cổng thanh toán mô phỏng.
-- 4. Đổi trạng thái đơn: chỉ admin, chỉ được sửa cột status; hủy đơn thì trả lại tồn kho;
--    đơn đã hoàn tất / đã hủy thì không đổi được nữa.
-- =====================================================================

alter table public.orders add column if not exists paid_at timestamptz;

-- ---------- Đặt hàng (thay bản cũ) ----------
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
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Giỏ hàng trống';
  end if;
  if coalesce(trim(p_shipping_name), '') = ''
     or coalesce(trim(p_shipping_phone), '') = ''
     or coalesce(trim(p_shipping_address), '') = '' then
    raise exception 'Vui lòng nhập đủ họ tên, số điện thoại và địa chỉ giao hàng';
  end if;
  if p_payment_method not in ('cod', 'mock_online') then
    raise exception 'Phương thức thanh toán không hợp lệ';
  end if;

  insert into public.orders (user_id, payment_method, shipping_name, shipping_phone, shipping_address, note)
  values (auth.uid(), p_payment_method, trim(p_shipping_name), trim(p_shipping_phone),
          trim(p_shipping_address), nullif(trim(p_note), ''))
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item ->> 'quantity')::int;
    if v_qty is null or v_qty <= 0 or v_qty > 10 then
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

-- ---------- Thanh toán mô phỏng ----------
-- Chỉ chủ đơn, đơn chọn "mock_online", đang chờ xử lý và chưa thanh toán.
-- Thanh toán xong thì đơn chuyển sang "confirmed".
create or replace function public.mock_pay_order(p_order_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.user_id is distinct from auth.uid() then
    raise exception 'Không tìm thấy đơn hàng';
  end if;
  if v_order.payment_method <> 'mock_online' then
    raise exception 'Đơn này thanh toán khi nhận hàng (COD)';
  end if;
  if v_order.paid_at is not null then
    raise exception 'Đơn này đã được thanh toán';
  end if;
  if v_order.status <> 'pending' then
    raise exception 'Đơn này không còn chờ thanh toán';
  end if;

  update public.orders set paid_at = now(), status = 'confirmed' where id = p_order_id;
end;
$$;

revoke execute on function public.mock_pay_order(bigint) from public;
grant execute on function public.mock_pay_order(bigint) to authenticated;

-- ---------- Đổi trạng thái đơn ----------
-- Admin chỉ được sửa cột status (không sửa tổng tiền, người nhận...).
revoke update on public.orders from authenticated, anon;
grant update (status) on public.orders to authenticated;

create or replace function public.handle_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;
  if old.status in ('completed', 'cancelled') then
    raise exception 'Đơn đã % thì không đổi trạng thái được nữa',
      case old.status when 'completed' then 'hoàn tất' else 'hủy' end;
  end if;

  -- Hủy đơn: trả lại hàng vào kho.
  if new.status = 'cancelled' then
    -- Gom theo sản phẩm: một đơn có thể có 2 dòng cùng sản phẩm (gọi place_order trực tiếp).
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

drop trigger if exists orders_status_change on public.orders;
create trigger orders_status_change
  before update of status on public.orders
  for each row execute function public.handle_order_status_change();
