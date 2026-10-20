import { useCallback, useEffect, useMemo, useState } from 'react'
import { CartContext } from '../hooks/useCart'
import {
  STORAGE_KEY,
  addManyToCart,
  addToCart,
  cartCount,
  cartSubtotal,
  mergeFreshProducts,
  parseStoredCart,
  removeFromCart,
  setItemQty,
} from '../features/cart/cart'

// localStorage có thể bị chặn (trình duyệt ẩn danh, tắt cookie) → bọc try/catch, lỗi thì coi như giỏ rỗng.
function loadCart() {
  try {
    return parseStoredCart(localStorage.getItem(STORAGE_KEY))
  } catch {
    return []
  }
}

// Bọc toàn bộ app (trong main.jsx). Giỏ lưu trong localStorage nên chưa đăng nhập vẫn dùng được,
// tải lại trang không mất. Mở 2 tab thì tab kia tự cập nhật theo (sự kiện "storage").
export function CartProvider({ children }) {
  const [items, setItems] = useState(loadCart)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch {
      // Không lưu được thì giỏ vẫn chạy trong phiên hiện tại.
    }
  }, [items])

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY) setItems(parseStoredCart(e.newValue))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const addItem = useCallback(
    (product, qty = 1) => setItems((cur) => addToCart(cur, product, qty)),
    [],
  )
  // entries: [{ product, qty }] – dùng khi thêm cả cấu hình từ Build PC.
  const addItems = useCallback((entries) => setItems((cur) => addManyToCart(cur, entries)), [])
  const setQty = useCallback((id, qty) => setItems((cur) => setItemQty(cur, id, qty)), [])
  const removeItem = useCallback((id) => setItems((cur) => removeFromCart(cur, id)), [])
  const clear = useCallback(() => setItems([]), [])
  // Cập nhật giá/tồn kho theo dữ liệu mới từ DB (trang giỏ hàng gọi khi mở).
  const refresh = useCallback(
    (products) => setItems((cur) => mergeFreshProducts(cur, products)),
    [],
  )

  const value = useMemo(
    () => ({
      items,
      count: cartCount(items),
      subtotal: cartSubtotal(items),
      addItem,
      addItems,
      setQty,
      removeItem,
      clear,
      refresh,
    }),
    [items, addItem, addItems, setQty, removeItem, clear, refresh],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
