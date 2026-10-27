import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { canAccess } from '../lib/roles'

// Bọc một tuyến chỉ cho một số vai trò vào: <RoleRoute allow={AREA_ROLES.admin}><Admin /></RoleRoute>
// - chưa đăng nhập → sang trang đăng nhập, xong quay lại đúng trang này
// - đăng nhập nhưng sai vai trò → báo không có quyền (không chuyển đi đâu để người dùng hiểu vì sao)
// Ẩn giao diện chỉ để tiện; bảo vệ thật nằm ở RLS trong DB.
export default function RoleRoute({ allow, children }) {
  const { user, loading, role, profileLoading, profileError, reloadProfile } = useAuth()
  const location = useLocation()

  // profile tải sau user một chút → chờ tải xong (kể cả khi lỗi) rồi mới quyết định.
  if (loading || profileLoading)
    return <p className="py-16 text-center text-slate-500">Đang kiểm tra quyền…</p>
  if (!user) {
    const next = location.pathname + location.search
    return <Navigate to={`/dang-nhap?next=${encodeURIComponent(next)}`} replace />
  }
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
  if (!canAccess(role, allow)) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-xl font-bold">Không có quyền truy cập</h1>
        <p className="mt-2 text-slate-500">Tài khoản của bạn không được mở trang này.</p>
      </div>
    )
  }
  return children
}
