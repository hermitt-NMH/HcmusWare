import { createContext, useContext } from 'react'

// Context chứa giỏ hàng. Provider nằm ở src/context/CartContext.jsx.
export const CartContext = createContext(null)

// Dùng trong component: const { items, count, addItem, setQty, removeItem } = useCart()
export function useCart() {
  const value = useContext(CartContext)
  if (!value) throw new Error('useCart phải dùng bên trong <CartProvider>')
  return value
}
