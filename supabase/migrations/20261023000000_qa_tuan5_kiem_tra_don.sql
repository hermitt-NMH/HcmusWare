-- =====================================================================
-- Sửa lỗi QA Tuần 5 (docs/test-plan.md, BUG05, BUG06, BUG08).
-- BUG05: gửi nhiều dòng cùng một sản phẩm (10 + 10 + ...) vượt được giới hạn 10 chiếc/sản phẩm
--        → một tài khoản giữ hết tồn kho. Sửa: cộng dồn số lượng theo sản phẩm rồi mới kiểm tra.
-- BUG06: gọi thẳng place_order bỏ qua được kiểm tra của form: SĐT "abc", tên 100.000 ký tự,
--        phương thức thanh toán null báo lỗi tiếng Anh. Sửa: kiểm tra lại trong DB.
-- BUG08: admin chuyển được đơn online CHƯA thanh toán sang "Đã xác nhận"/"Đang giao"
--        → khách mất nút thanh toán. Sửa: đơn online chưa trả chỉ được giữ nguyên hoặc hủy.
-- =====================================================================

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
  -- coalesce: null "not in (...)" ra null (không phải true) nên trước đây lọt qua.
  if coalesce(p_payment_method, '') not in ('cod', 'mock_online') then
    raise exception 'Phương thức thanh toán không hợp lệ';
  end if;

  -- Kiểm tra từng dòng trước khi gom.
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

  -- Gom các dòng cùng sản phẩm (BUG05). Khóa sản phẩm theo thứ tự id để 2 đơn cùng lúc không kẹt nhau.
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

    if not found then
      raise exception 'Sản phẩm % không tồn tại', v_line.product_id;
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

-- ---------- Đổi trạng thái đơn (thêm chặn BUG08) ----------
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

  -- Đơn online chưa thanh toán: chỉ hủy được (mock_pay_order đặt paid_at cùng lúc nên vẫn qua).
  if old.payment_method = 'mock_online' and new.paid_at is null and new.status <> 'cancelled' then
    raise exception 'Đơn thanh toán online chưa được thanh toán, chỉ có thể hủy';
  end if;

  -- Hủy đơn: trả lại hàng vào kho.
  if new.status = 'cancelled' then
    -- Gom theo sản phẩm: đơn cũ (trước bản sửa BUG05) có thể có 2 dòng cùng sản phẩm.
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
