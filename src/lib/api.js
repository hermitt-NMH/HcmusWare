import { supabase } from './supabase'
import { toSlug } from './slug'

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
// Kèm tên + đường dẫn shop và thương hiệu (F15: "Bán bởi", "Thương hiệu", bộ lọc theo shop)
// và điểm đánh giá trung bình (F16; null khi chưa có lượt nào).
const ON_SALE_SHOP =
  'shops!inner(status, name, slug), brands(name, slug), product_ratings(rating_avg, rating_count)'
const onSale = (query) => query.eq('status', 'active').eq('shops.status', 'active')

// brandId / shopId: trang thương hiệu, trang shop (F15).
export async function getProducts({ categorySlug, brandId, shopId, limit } = {}) {
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
  if (brandId) query = query.eq('brand_id', brandId)
  if (shopId) query = query.eq('shop_id', shopId)
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
        `id, name, brand, price, stock, image_url, images, datasheet_url, description, specs, categories(slug, name), ${ON_SALE_SHOP}`,
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

// shop_id, payment_code, shops: Giai đoạn 2 – Tuần 3 (mỗi đơn thuộc một shop, nhiều đơn chung mã thanh toán).
const ORDER_FIELDS =
  'id, status, payment_method, total, shipping_name, shipping_phone, shipping_address, note, paid_at, created_at, shop_id, payment_code, shops(name, slug)'

// Tạo đơn qua hàm place_order trong DB (giá, tổng tiền, tồn kho do DB tính).
// Giỏ có hàng của nhiều shop → mỗi shop một đơn cùng mã thanh toán; trả id đơn đầu tiên.
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

// Trả cả nhóm đơn cùng mã thanh toán với đơn orderId.
export async function mockPayOrder(orderId) {
  const { error } = await supabase.rpc('mock_pay_order', { p_order_id: orderId })
  if (error) throw error
}

// Đơn của người đang đăng nhập, mới nhất trước (admin dùng getAdminOrders).
// Lọc user_id vì RLS còn cho người bán đọc đơn của shop mình.
export async function getMyOrders(userId) {
  const { data, error } = await supabase
    .from('orders')
    .select(`${ORDER_FIELDS}, order_items(quantity)`)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
  if (error) throw error
  return data
}

// Các đơn của mình cùng một lần đặt (cùng mã thanh toán), theo thứ tự tạo.
export async function getMyOrdersByPaymentCode(userId, code) {
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_FIELDS)
    .eq('user_id', userId)
    .eq('payment_code', code)
    .order('id')
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

const MANAGED_ORDER_FIELDS = `${ORDER_FIELDS}, order_items(id, product_id, quantity, unit_price, products(name))`

export async function getAdminOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select(MANAGED_ORDER_FIELDS)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
  if (error) throw error
  return data
}

// Đơn của shop (kênh người bán). Lọc shop_id vì RLS còn trả cả đơn người bán tự mua.
export async function getShopOrders(shopId) {
  const { data, error } = await supabase
    .from('orders')
    .select(MANAGED_ORDER_FIELDS)
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
  if (error) throw error
  return data
}

// Admin: mọi đơn; người bán: đơn của shop mình đang hoạt động (RLS orders_update).
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
    .select(SHOP_FIELDS)
    .eq('owner_id', userId)
    .maybeSingle()
  if (error) throw error
  return data
}

// ---------- Kênh người bán, thương hiệu (Giai đoạn 2 – Tuần 2) ----------

const SHOP_FIELDS = 'id, name, slug, description, logo_url, status, review_note, created_at'

// Đăng ký mở shop. owner_id và status do trigger guard_shop_write trong DB tự đặt (chờ duyệt).
export async function createShop(data) {
  const { data: shop, error } = await supabase
    .from('shops')
    .insert(data)
    .select(SHOP_FIELDS)
    .single()
  if (error) throw error
  return shop
}

// Sửa tên, mô tả, logo. resubmit: shop bị từ chối gửi lại → chờ duyệt (DB xóa lý do cũ).
export async function updateShop(id, data, { resubmit = false } = {}) {
  const { data: shop, error } = await supabase
    .from('shops')
    .update(resubmit ? { ...data, status: 'pending' } : data)
    .eq('id', id)
    .select(SHOP_FIELDS)
    .single()
  if (error) throw error
  return shop
}

// Tải ảnh lên bucket product-images, thư mục <shop_id>/ (Storage chỉ cho chủ shop ghi vào đây).
// Trả link công khai của ảnh.
export async function uploadShopImage(shopId, file) {
  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[file.type] ?? 'img'
  const path = `${shopId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabase.storage
    .from('product-images')
    .upload(path, file, { contentType: file.type, cacheControl: '31536000' })
  if (error) throw error
  return supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl
}

// Danh sách thương hiệu cho ô chọn (người bán chỉ chọn, không tạo – C1).
export async function getBrands() {
  const { data, error } = await supabase.from('brands').select('id, name, slug').order('name')
  if (error) throw error
  return data
}

// Trang /thuong-hieu: kèm số sản phẩm đang bán (hàm brand_list đếm như nhau cho mọi người).
export async function getBrandList() {
  const { data, error } = await supabase.rpc('brand_list')
  if (error) throw error
  return data
}

export async function getBrandBySlug(slug) {
  const { data, error } = await supabase
    .from('brands')
    .select('id, name, slug, logo_url')
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw error
  return data
}

// Trang /shop/:slug chỉ mở được shop đang hoạt động; chủ shop xem shop chờ duyệt của mình cũng ra 404.
export async function getShopBySlug(slug) {
  const { data, error } = await supabase
    .from('shops')
    .select('id, name, slug, description, logo_url, created_at')
    .eq('slug', slug)
    .eq('status', 'active')
    .maybeSingle()
  if (error) throw error
  return data
}

const SELLER_PRODUCT_FIELDS =
  'id, category_id, name, brand_id, brand, price, stock, image_url, images, datasheet_url, description, specs, status, approved_at, review_note, created_at, categories(slug, name)'

// Mọi sản phẩm của shop (mọi trạng thái – RLS cho chủ shop đọc).
export async function getSellerProducts(shopId) {
  const { data, error } = await supabase
    .from('products')
    .select(SELLER_PRODUCT_FIELDS)
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
  if (error) throw error
  return data
}

export async function getSellerProduct(shopId, id) {
  if (!/^\d+$/.test(String(id)) || !Number.isSafeInteger(Number(id))) return null
  const { data, error } = await supabase
    .from('products')
    .select(SELLER_PRODUCT_FIELDS)
    .eq('shop_id', shopId)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

// Thêm (không có id) hoặc sửa sản phẩm của shop. Thêm mới luôn chờ duyệt (trigger trong DB).
// Trả dòng sau khi lưu để biết trạng thái mới (đổi thông số → chờ duyệt lại, C3).
export async function saveSellerProduct(shopId, id, fields) {
  const query = id
    ? supabase.from('products').update(fields).eq('id', id).eq('shop_id', shopId)
    : supabase.from('products').insert({ ...fields, shop_id: shopId })
  const { data, error } = await query.select(SELLER_PRODUCT_FIELDS).single()
  if (error) throw error
  return data
}

// Ẩn ('hidden'), hiện lại ('active') hoặc gửi duyệt lại ('pending').
export async function setSellerProductStatus(id, status) {
  const { data, error } = await supabase
    .from('products')
    .update({ status })
    .eq('id', id)
    .select(SELLER_PRODUCT_FIELDS)
    .single()
  if (error) throw error
  return data
}

// ---------- Admin duyệt shop / sản phẩm (Giai đoạn 2 – Tuần 2) ----------

// status: 'pending' | 'active' | 'locked' | 'rejected' | null (tất cả)
export async function getAdminShops(status = null) {
  const { data, error } = await supabase.rpc('admin_list_shops', { p_status: status })
  if (error) throw error
  return data
}

export async function approveShop(id) {
  const { error } = await supabase.rpc('approve_shop', { p_shop_id: id })
  if (error) throw error
}

export async function rejectShop(id, note) {
  const { error } = await supabase.rpc('reject_shop', { p_shop_id: id, p_note: note })
  if (error) throw error
}

export async function setShopLocked(id, locked) {
  const { error } = await supabase.rpc('set_shop_locked', { p_shop_id: id, p_locked: locked })
  if (error) throw error
}

// Sản phẩm chờ duyệt, cũ nhất lên trên.
export async function getPendingProducts() {
  const { data, error } = await supabase
    .from('products')
    .select(
      'id, name, brand_id, brand, price, stock, image_url, images, description, datasheet_url, specs, created_at, categories(slug, name), shops(name, slug)',
    )
    .eq('status', 'pending')
    .order('created_at')
    .order('id')
  if (error) throw error
  return data
}

export async function approveProduct(id) {
  const { error } = await supabase.rpc('approve_product', { p_product_id: id })
  if (error) throw error
}

export async function rejectProduct(id, note) {
  const { error } = await supabase.rpc('reject_product', { p_product_id: id, p_note: note })
  if (error) throw error
}

// Admin gán thương hiệu cho sản phẩm "Thương hiệu khác" trước khi duyệt (C1).
export async function setProductBrand(id, brandId) {
  const { error } = await supabase.from('products').update({ brand_id: brandId }).eq('id', id)
  if (error) throw error
}

export async function createBrand(name, logoUrl = null) {
  const { data, error } = await supabase
    .from('brands')
    .insert({ name: name.trim(), slug: toSlug(name), logo_url: logoUrl })
    .select('id, name, slug')
    .single()
  if (error) throw error
  return data
}

// Trang admin /admin/thuong-hieu (US-15.6): mọi thương hiệu kèm số sản phẩm ở MỌI trạng thái
// (admin đọc được hết), vì sản phẩm nào còn trỏ tới thương hiệu thì DB đều chặn xóa.
export async function getAdminBrands() {
  const { data, error } = await supabase
    .from('brands')
    .select('id, name, slug, logo_url, products(count)')
    .order('name')
  if (error) throw error
  return data.map(({ products, ...b }) => ({ ...b, product_count: products[0]?.count ?? 0 }))
}

// Sửa tên / logo. Đổi tên thì đổi luôn slug (để chặn trùng như lúc thêm); trigger brands_sync_name
// trong DB tự chép tên mới sang cột chữ products.brand (bộ lọc, tìm kiếm đọc cột này).
export async function updateBrand(id, { name, logo_url }) {
  const { data, error } = await supabase
    .from('brands')
    .update({ name, slug: toSlug(name), logo_url })
    .eq('id', id)
    .select('id, name, slug, logo_url')
    .single()
  if (error) throw error
  return data
}

export async function deleteBrand(id) {
  const { error } = await supabase.from('brands').delete().eq('id', id)
  if (error) throw error
}

// Logo thương hiệu nằm chung bucket ảnh, thư mục "thuong-hieu/" (chỉ admin ghi được thư mục không phải shop).
export function uploadBrandLogo(file) {
  return uploadShopImage('thuong-hieu', file)
}

// ---------- Sổ địa chỉ (Giai đoạn 2 – Tuần 3, F17) ----------
// RLS chỉ cho đọc/ghi địa chỉ của chính mình; trigger trong DB giữ đúng 1 địa chỉ mặc định, tối đa 10.

const ADDRESS_FIELDS =
  'id, recipient_name, phone, province_code, province_name, ward_code, ward_name, street, is_default, created_at'

// Mặc định lên đầu, còn lại mới nhất trước.
export async function getMyAddresses() {
  const { data, error } = await supabase
    .from('addresses')
    .select(ADDRESS_FIELDS)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
  if (error) throw error
  return data
}

// Thêm (id null) hoặc sửa. fields: kết quả validateAddress (+ is_default nếu muốn).
export async function saveAddress(id, fields) {
  const query = id
    ? supabase.from('addresses').update(fields).eq('id', id)
    : supabase.from('addresses').insert(fields)
  const { data, error } = await query.select(ADDRESS_FIELDS).single()
  if (error) throw error
  return data
}

// Xóa địa chỉ mặc định → DB tự chọn địa chỉ thêm gần nhất làm mặc định.
export async function deleteAddress(id) {
  const { error } = await supabase.from('addresses').delete().eq('id', id)
  if (error) throw error
}

export async function setDefaultAddress(id) {
  const { error } = await supabase.from('addresses').update({ is_default: true }).eq('id', id)
  if (error) throw error
}

// ---------- Đánh giá (Giai đoạn 2 – Tuần 4, F16) ----------
// DB chặn người chưa nhận hàng, đánh giá lần 2 và việc tự đổi cột hidden (migration 20261214000000).

const REVIEW_FIELDS = 'id, user_id, rating, comment, author_name, hidden, created_at, updated_at'

// Mới nhất trước. Admin nhận cả đánh giá đã ẩn (RLS), người viết nhận cả đánh giá đã ẩn của mình.
export async function getProductReviews(productId) {
  const { data, error } = await supabase
    .from('reviews')
    .select(REVIEW_FIELDS)
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
  if (error) throw error
  return data
}

// Đã có đơn Hoàn tất chứa sản phẩm chưa (để hiện form). Chưa đăng nhập thì khỏi gọi.
export async function canReview(productId) {
  const { data, error } = await supabase.rpc('can_review', { p_product_id: Number(productId) })
  if (error) throw error
  return data
}

// Thêm (id null) hoặc sửa đánh giá của mình. fields: kết quả validateReview.
export async function saveReview(id, productId, fields) {
  const query = id
    ? supabase.from('reviews').update(fields).eq('id', id)
    : supabase.from('reviews').insert({ product_id: Number(productId), ...fields })
  const { data, error } = await query.select(REVIEW_FIELDS).single()
  if (error) throw error
  return data
}

export async function setReviewHidden(id, hidden) {
  const { error } = await supabase.rpc('set_review_hidden', { p_id: id, p_hidden: hidden })
  if (error) throw error
}

// Điểm trung bình cả shop: { rating_avg, rating_count } (rating_count = 0 khi chưa có).
export async function getShopRating(shopId) {
  const { data, error } = await supabase.rpc('shop_rating', { p_shop_id: shopId })
  if (error) throw error
  return data?.[0] ?? { rating_avg: null, rating_count: 0 }
}

// ---------- Hỏi đáp (Giai đoạn 2 – Tuần 4, F16) ----------
// Câu hỏi + 1 cấp trả lời. Nhãn "Người bán" (is_seller) do DB kiểm tra: chủ shop của sản phẩm, hoặc admin trên sản phẩm shop HcmusWare (C9).

const COMMENT_FIELDS = 'id, parent_id, user_id, body, is_seller, author_name, hidden, created_at'

// Danh sách phẳng (dùng groupThreads để gom). Admin nhận cả bình luận đã ẩn (RLS).
export async function getProductComments(productId) {
  const { data, error } = await supabase
    .from('comments')
    .select(COMMENT_FIELDS)
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
  if (error) throw error
  return data
}

// parentId null = câu hỏi mới; có parentId = trả lời câu hỏi đó.
export async function addComment({ productId, parentId = null, body, isSeller = false }) {
  const { data, error } = await supabase
    .from('comments')
    .insert({ product_id: Number(productId), parent_id: parentId, body, is_seller: isSeller })
    .select(COMMENT_FIELDS)
    .single()
  if (error) throw error
  return data
}

export async function setCommentHidden(id, hidden) {
  const { error } = await supabase.rpc('set_comment_hidden', { p_id: id, p_hidden: hidden })
  if (error) throw error
}

// Kênh người bán: câu hỏi trên sản phẩm của shop mình chưa có câu trả lời nhãn "Người bán".
export async function getUnansweredQuestions() {
  const { data, error } = await supabase.rpc('seller_unanswered_questions')
  if (error) throw error
  return data
}
