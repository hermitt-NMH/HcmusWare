import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import AdminProducts from './AdminProducts'
import AdminOrders from './AdminOrders'

const tabClass = ({ isActive }) =>
  `inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-medium ${
    isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
  }`

// Trang quản trị /admin/san-pham và /admin/don-hang. Chỉ tài khoản role = 'admin' vào được.
// Ẩn giao diện chỉ để tiện; bảo vệ thật nằm ở RLS trong DB (người thường có gọi API cũng bị chặn).
export default function Admin() {
  const { user, profile, loading, isAdmin } = useAuth()
  const location = useLocation()

  // profile tải sau user một chút → chờ cả hai rồi mới quyết định.
  if (loading || (user && !profile))
    return <p className="py-16 text-center text-slate-500">Đang kiểm tra quyền…</p>
  if (!user)
    return <Navigate to={`/dang-nhap?next=${encodeURIComponent(location.pathname)}`} replace />
  if (!isAdmin) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-xl font-bold">Không có quyền truy cập</h1>
        <p className="mt-2 text-slate-500">Trang này chỉ dành cho quản trị viên.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold sm:text-2xl">Quản trị</h1>
        <nav className="flex gap-1 rounded-xl bg-white p-1 ring-1 ring-slate-200">
          <NavLink to="/admin/san-pham" className={tabClass}>
            Sản phẩm
          </NavLink>
          <NavLink to="/admin/don-hang" className={tabClass}>
            Đơn hàng
          </NavLink>
        </nav>
      </div>
      <Routes>
        <Route index element={<Navigate to="san-pham" replace />} />
        <Route path="san-pham" element={<AdminProducts />} />
        <Route path="don-hang" element={<AdminOrders />} />
        <Route path="*" element={<Navigate to="san-pham" replace />} />
      </Routes>
    </div>
  )
}
