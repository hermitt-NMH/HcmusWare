// Logic giỏ hàng dạng HÀM THUẦN (không đụng React, localStorage hay mạng) để dễ viết unit test.
// CartContext gọi các hàm này rồi lưu kết quả vào state + localStorage.
//
// Một dòng trong giỏ: bản chụp vài trường của sản phẩm lúc thêm vào giỏ + số lượng.
// { id, name, brand, price, image_url, slug, stock, qty }
// Giá/tồn kho có thể đã đổi trên DB: trang giỏ hàng gọi mergeFreshProducts để cập nhật lại.

export const STORAGE_KEY = 'hcmusware.cart'

// Không cho mua quá số này một lần dù kho còn nhiều (giỏ lẻ, không phải đơn sỉ).
export const MAX_QTY_PER_ITEM = 10

// Số lượng tối đa của một sản phẩm: không quá tồn kho và không quá MAX_QTY_PER_ITEM.
export function maxQty(item) {
  const stock = Number.isFinite(item?.stock) ? item.stock : MAX_QTY_PER_ITEM
  return Math.max(0, Math.min(stock, MAX_QTY_PER_ITEM))
}

// Chụp các trường cần hiện trong giỏ từ một dòng products (có categories.slug).
export function toCartItem(product, qty = 1) {
  return {
    id: product.id,
    name: product.name,
    brand: product.brand ?? null,
    price: product.price ?? null,
    image_url: product.image_url ?? null,
    slug: product.categories?.slug ?? product.slug ?? null,
    stock: product.stock ?? 0,
    qty,
  }
}

// Thêm nhiều sản phẩm một lần: [{ product, qty }]. Sản phẩm đã có thì cộng dồn.
// Số lượng bị giới hạn bởi maxQty; sản phẩm hết hàng thì bỏ qua.
export function addManyToCart(items, entries) {
  const next = items.map((it) => ({ ...it }))
  for (const { product, qty = 1 } of entries) {
    if (!product || qty <= 0) continue
    const fresh = toCartItem(product, 0)
    const existing = next.find((it) => it.id === fresh.id)
    const line = existing ?? fresh
    // Cập nhật giá/tồn kho mới nhất mỗi lần thêm.
    Object.assign(line, { ...fresh, qty: line.qty })
    line.qty = Math.min(line.qty + qty, maxQty(line))
    if (!existing && line.qty > 0) next.push(line)
  }
  return next.filter((it) => it.qty > 0)
}

export function addToCart(items, product, qty = 1) {
  return addManyToCart(items, [{ product, qty }])
}

// Đổi số lượng. qty ≤ 0 thì xóa khỏi giỏ.
export function setItemQty(items, id, qty) {
  if (!(qty > 0)) return removeFromCart(items, id)
  return items.map((it) =>
    it.id === id ? { ...it, qty: Math.min(Math.floor(qty), maxQty(it)) } : it,
  )
}

export function removeFromCart(items, id) {
  return items.filter((it) => it.id !== id)
}

export function cartCount(items) {
  return items.reduce((sum, it) => sum + it.qty, 0)
}

// Tạm tính: chỉ cộng các dòng còn hàng và có giá.
export function cartSubtotal(items) {
  return items.reduce(
    (sum, it) => (it.price != null && !isUnavailable(it) ? sum + it.price * it.qty : sum),
    0,
  )
}

// Dòng không mua được: sản phẩm đã bị xóa trên DB hoặc hết hàng.
export function isUnavailable(item) {
  return Boolean(item.missing) || item.stock <= 0
}

// Cập nhật giỏ theo dữ liệu mới từ DB (mảng products theo id).
// Sản phẩm không còn trên DB → đánh dấu missing; số lượng vượt tồn kho mới → hạ xuống.
export function mergeFreshProducts(items, products) {
  const byId = new Map(products.map((p) => [p.id, p]))
  return items.map((it) => {
    const p = byId.get(it.id)
    if (!p) return { ...it, missing: true }
    const fresh = { ...toCartItem(p, it.qty), missing: false }
    // Hết hàng thì giữ số lượng cũ để khách thấy và tự xóa; còn hàng thì không vượt tồn kho.
    if (fresh.stock > 0) fresh.qty = Math.min(it.qty, maxQty(fresh))
    return fresh
  })
}

// Đọc giỏ đã lưu trong localStorage. Dữ liệu hỏng/lạ thì bỏ qua (trả giỏ rỗng hoặc lọc dòng sai).
export function parseStoredCart(raw) {
  if (!raw) return []
  let data
  try {
    data = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(data)) return []
  return data
    .filter(
      (it) =>
        it &&
        Number.isSafeInteger(it.id) &&
        typeof it.name === 'string' &&
        Number.isInteger(it.qty) &&
        it.qty > 0,
    )
    .map((it) => ({ ...it, qty: Math.min(it.qty, MAX_QTY_PER_ITEM) }))
}
