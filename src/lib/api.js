import { supabase } from './supabase'

// Gom các truy vấn Supabase hay dùng vào một chỗ để các trang gọi lại.

export async function getCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, slug')
    .order('sort_order')
  if (error) throw error
  return data
}

// Lấy một danh mục theo slug. Không có thì trả null (để trang hiện 404).
export async function getCategoryBySlug(slug) {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, slug')
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw error
  return data
}

// Trang bán hàng (danh sách, chi tiết, giỏ, Builder) chỉ lấy hàng ĐANG BÁN của shop ĐANG HOẠT ĐỘNG.
// RLS còn cho admin, chủ shop và người đã mua đọc hàng chờ duyệt / đã ẩn (để quản lý, xem lại đơn cũ),
// nên phải lọc ở đây – không thì những người đó thấy cả hàng không mua được trên web.
const ON_SALE_SHOP = 'shops!inner(status)'
const onSale = (query) => query.eq('status', 'active').eq('shops.status', 'active')

export async function getProducts({ categorySlug, limit } = {}) {
  let query = supabase
    .from('products')
    .select(
      `id, name, brand, price, stock, image_url, specs, categories!inner(slug, name), ${ON_SALE_SHOP}`,
    )
    .order('created_at', { ascending: false })
    // Nhiều sản phẩm trùng created_at (nhập cùng lúc) nên thêm id làm khóa phụ
    // để thứ tự luôn cố định giữa các lần tải.
    .order('id', { ascending: false })

  query = onSale(query)
  if (categorySlug) query = query.eq('categories.slug', categorySlug)
  if (limit) query = query.limit(limit)

  const { data, error } = await query
  if (error) throw error
  return data
}

// Chi tiết một sản phẩm. id sai hoặc không tồn tại thì trả null (để trang hiện 404).
export async function getProductById(id) {
  // id trên URL không phải số (vd /san-pham/abc) thì khỏi gọi DB – Postgres sẽ báo lỗi kiểu dữ liệu.
  // id quá lớn (vượt kiểu bigint, vd /san-pham/99999999999999999999) cũng không tồn tại → 404.
  if (!/^\d+$/.test(String(id)) || !Number.isSafeInteger(Number(id))) return null
  const { data, error } = await onSale(
    supabase
      .from('products')
      .select(
        `id, name, brand, price, stock, image_url, datasheet_url, description, specs, categories(slug, name), ${ON_SALE_SHOP}`,
      )
      .eq('id', id),
  ).maybeSingle()
  if (error) throw error
  return data
}

// Nhiều sản phẩm theo danh sách id (trang giỏ hàng lấy giá, tồn kho mới nhất).
// id không còn trên DB thì đơn giản là không có trong kết quả.
export async function getProductsByIds(ids) {
  if (!ids.length) return []
  const { data, error } = await onSale(
    supabase
      .from('products')
      .select(`id, name, brand, price, stock, image_url, categories(slug), ${ON_SALE_SHOP}`)
      .in('id', ids),
  )
  if (error) throw error
  return data
}

// Sản phẩm cùng danh mục (trừ chính nó) cho mục "Sản phẩm tương tự".
export async function getRelatedProducts({ categorySlug, excludeId, limit = 4 }) {
  const { data, error } = await onSale(
    supabase
      .from('products')
      .select(
        `id, name, brand, price, stock, image_url, specs, categories!inner(slug, name), ${ON_SALE_SHOP}`,
      ),
  )
    .eq('categories.slug', categorySlug)
    .neq('id', excludeId)
    .gt('stock', 0)
    .order('id', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

// ---------- Lịch sử giá, cảnh báo giá (Tuần 5) ----------

// Lịch sử giá 6 tháng gần nhất, cũ → mới.
export async function getPriceHistory(productId, months = 6) {
  const since = new Date()
  since.setMonth(since.getMonth() - months)
  const { data, error } = await supabase
    .from('price_history')
    .select('price, recorded_at')
    .eq('product_id', productId)
    .gte('recorded_at', since.toISOString())
    .order('recorded_at')
  if (error) throw error
  return data
}

// Cảnh báo giá của người đang đăng nhập (RLS chỉ trả của chính mình), kèm giá hiện tại.
export async function getMyPriceAlerts() {
  const { data, error } = await supabase
    .from('price_alerts')
    .select(
      'id, product_id, target_price, notified, created_at, products(id, name, price, image_url, categories(slug))',
    )
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

// Cảnh báo giá của mình cho một sản phẩm (chưa đặt thì null).
export async function getMyPriceAlert(productId) {
  const { data, error } = await supabase
    .from('price_alerts')
    .select('id, product_id, target_price, notified')
    .eq('product_id', productId)
    .maybeSingle()
  if (error) throw error
  return data
}

// Đặt / đổi giá mong muốn. Đổi giá thì bật lại thông báo (notified = false).
export async function upsertPriceAlert(userId, productId, targetPrice) {
  const { data, error } = await supabase
    .from('price_alerts')
    .upsert(
      { user_id: userId, product_id: productId, target_price: targetPrice, notified: false },
      { onConflict: 'user_id,product_id' },
    )
    .select('id, product_id, target_price, notified')
    .single()
  if (error) throw error
  return data
}

export async function deletePriceAlert(id) {
  const { error } = await supabase.from('price_alerts').delete().eq('id', id)
  if (error) throw error
}

// Khách bấm "Đã xem" trên thông báo giảm giá.
export async function markAlertsNotified(ids) {
  if (!ids.length) return
  const { error } = await supabase.from('price_alerts').update({ notified: true }).in('id', ids)
  if (error) throw error
}

// ---------- Đơn hàng (Tuần 5) ----------

const ORDER_FIELDS =
  'id, status, payment_method, total, shipping_name, shipping_phone, shipping_address, note, paid_at, created_at'

// Tạo đơn qua hàm place_order trong DB (giá, tổng tiền, tồn kho do DB tính). Trả id đơn.
export async function placeOrder({ items, name, phone, address, payment, note }) {
  const { data, error } = await supabase.rpc('place_order', {
    p_items: items,
    p_shipping_name: name,
    p_shipping_phone: phone,
    p_shipping_address: address,
    p_payment_method: payment,
    p_note: note || null,
  })
  if (error) throw error
  return data
}

export async function mockPayOrder(orderId) {
  const { error } = await supabase.rpc('mock_pay_order', { p_order_id: orderId })
  if (error) throw error
}

// Đơn của người đang đăng nhập, mới nhất trước (admin dùng getAdminOrders).
export async function getMyOrders(userId) {
  const { data, error } = await supabase
    .from('orders')
    .select(`${ORDER_FIELDS}, order_items(quantity)`)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

// Một đơn kèm từng sản phẩm. Không phải đơn của mình (và không phải admin) thì RLS trả null.
export async function getOrderById(id) {
  if (!/^\d+$/.test(String(id)) || !Number.isSafeInteger(Number(id))) return null
  const { data, error } = await supabase
    .from('orders')
    .select(
      `${ORDER_FIELDS}, order_items(id, product_id, quantity, unit_price, products(name, image_url, categories(slug)))`,
    )
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

// ---------- Cấu hình đã lưu (Tuần 5) ----------

// items lưu cùng dạng với localStorage của Builder: { ids: { cpu: 12, ... }, ramQty }
export async function saveBuild(userId, name, items) {
  const { data, error } = await supabase
    .from('saved_builds')
    .insert({ user_id: userId, name, items })
    .select('id, name, items, share_code, created_at')
    .single()
  if (error) throw error
  return data
}

export async function getMyBuilds(userId) {
  const { data, error } = await supabase
    .from('saved_builds')
    .select('id, name, items, share_code, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function deleteBuild(id) {
  const { error } = await supabase.from('saved_builds').delete().eq('id', id)
  if (error) throw error
}

// Mở cấu hình qua link chia sẻ (ai có mã cũng xem được, không lộ chủ sở hữu).
export async function getBuildByShareCode(code) {
  if (!/^[a-z0-9]{1,32}$/i.test(String(code))) return null
  const { data, error } = await supabase.rpc('get_build_by_share_code', { code })
  if (error) throw error
  return data?.[0] ?? null
}

// ---------- Quản trị (Tuần 5) – RLS chỉ cho admin ghi ----------

export async function getAdminProducts() {
  const { data, error } = await supabase
    .from('products')
    .select(
      'id, category_id, name, brand, price, stock, image_url, datasheet_url, description, specs, categories(slug, name)',
    )
    .order('id', { ascending: false })
  if (error) throw error
  return data
}

// Thêm (không có id) hoặc sửa sản phẩm. Đổi giá thì trigger trong DB tự ghi price_history.
export async function saveProduct({ id, ...fields }) {
  const query = id
    ? supabase.from('products').update(fields).eq('id', id)
    : supabase.from('products').insert(fields)
  const { data, error } = await query.select('id').single()
  if (error) throw error
  return data
}

// Sản phẩm đã nằm trong đơn hàng thì DB chặn xóa (khóa ngoại order_items). Kiểm tra trước để
// khỏi gửi lệnh xóa chắc chắn lỗi (trình duyệt sẽ ghi lỗi đỏ 409 trong Console – BUG03).
export async function deleteProduct(id) {
  const { count, error: countError } = await supabase
    .from('order_items')
    .select('id', { count: 'exact', head: true })
    .eq('product_id', id)
  if (countError) throw countError
  if (count > 0) throw Object.assign(new Error('Sản phẩm đã có trong đơn hàng'), { code: '23503' })

  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) throw error
}

export async function getAdminOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select(`${ORDER_FIELDS}, order_items(id, quantity, unit_price, products(name))`)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function updateOrderStatus(id, status) {
  const { data, error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', id)
    .select(ORDER_FIELDS)
    .single()
  if (error) throw error
  return data
}

// ---------- Phân quyền (Giai đoạn 2 – Tuần 1) ----------

// Danh sách người dùng kèm email, vai trò, shop. Hàm trong DB tự chặn nếu không phải admin.
export async function getAdminUsers(search = '') {
  const { data, error } = await supabase.rpc('admin_list_users', {
    p_search: search.trim() || null,
    p_limit: 100,
  })
  if (error) throw error
  return data
}

// Chỉ admin; DB chặn tự đổi vai trò của chính mình.
export async function setUserRole(userId, role) {
  const { error } = await supabase.rpc('set_user_role', { p_user_id: userId, p_role: role })
  if (error) throw error
}

// Shop của người đang đăng nhập (mỗi người tối đa 1 shop). Chưa có thì null.
export async function getMyShop(userId) {
  const { data, error } = await supabase
    .from('shops')
    .select('id, name, slug, description, logo_url, status, created_at')
    .eq('owner_id', userId)
    .maybeSingle()
  if (error) throw error
  return data
}
