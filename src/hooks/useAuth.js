import { createContext, useContext } from 'react'

// Context chứa trạng thái đăng nhập. Provider nằm ở src/context/AuthContext.jsx.
export const AuthContext = createContext(null)

// Dùng trong component: const { user, profile, signOut } = useAuth()
export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth phải dùng bên trong <AuthProvider>')
  return value
}
