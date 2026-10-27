import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import AdminProducts from './AdminProducts'
import AdminOrders from './AdminOrders'

const tabClass = ({ isActive }) =>
  `inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-medium ${
    isActive ? 'bg-gray-900 text-white dark:bg-blue-600' : 'text-slate-600 hover:bg-slate-100'
  }`

// Trang quản trị /admin/san-pham và /admin/don-hang. Chỉ tài khoản role = 'admin' vào được.
// Ẩn giao diện chỉ để tiện; bảo vệ thật nằm ở RLS trong DB (người thường có gọi API cũng bị chặn).
export default function Admin() {
  const { user, loading, isAdmin, profileLoading, profileError, reloadProfile } = useAuth()
  const location = useLocation()

  // profile tải sau user một chút → chờ tải xong (kể cả khi lỗi) rồi mới quyết định.
  if (loading || profileLoading)
    return <p className="py-16 text-center text-slate-500">Đang kiểm tra quyền…</p>
  if (!user)
    return <Navigate to={`/dang-nhap?next=${encodeURIComponent(location.pathname)}`} replace />
  if (profileError) {
    return (
      <div className="py-16 text-center">
        <p role="alert" className="text-red-700">
          Không kiểm tra được quyền truy cập (lỗi tải hồ sơ).
        </p>
        <button
          type="button"
          onClick={reloadProfile}
          className="mt-4 inline-flex h-11 items-center rounded-lg bg-blue-600 px-4 font-semibold text-white hover:bg-blue-700"
        >
          Thử lại
        </button>
      </div>
    )
  }
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
        <nav className="flex gap-1 rounded-xl bg-surface p-1 ring-1 ring-slate-200">
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
