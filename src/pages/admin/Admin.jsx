import { Navigate, NavLink, Route, Routes } from 'react-router-dom'
import AdminProducts from './AdminProducts'
import AdminOrders from './AdminOrders'
import AdminUsers from './AdminUsers'
import AdminReview from './AdminReview'

const tabClass = ({ isActive }) =>
  `inline-flex min-h-11 shrink-0 items-center rounded-lg px-4 text-sm font-medium ${
    isActive ? 'bg-gray-900 text-white dark:bg-blue-600' : 'text-slate-600 hover:bg-slate-100'
  }`

// Trang quản trị /admin/san-pham, /admin/duyet, /admin/don-hang, /admin/nguoi-dung.
// Kiểm tra vai trò do RoleRoute bọc ngoài (App.jsx) đảm nhận.
export default function Admin() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold sm:text-2xl">Quản trị</h1>
        <nav className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-surface p-1 ring-1 ring-slate-200">
          <NavLink to="/admin/san-pham" className={tabClass}>
            Sản phẩm
          </NavLink>
          <NavLink to="/admin/duyet" className={tabClass}>
            Duyệt
          </NavLink>
          <NavLink to="/admin/don-hang" className={tabClass}>
            Đơn hàng
          </NavLink>
          <NavLink to="/admin/nguoi-dung" className={tabClass}>
            Người dùng
          </NavLink>
        </nav>
      </div>
      <Routes>
        <Route index element={<Navigate to="san-pham" replace />} />
        <Route path="san-pham" element={<AdminProducts />} />
        <Route path="duyet" element={<AdminReview />} />
        <Route path="don-hang" element={<AdminOrders />} />
        <Route path="nguoi-dung" element={<AdminUsers />} />
        <Route path="*" element={<Navigate to="san-pham" replace />} />
      </Routes>
    </div>
  )
}
