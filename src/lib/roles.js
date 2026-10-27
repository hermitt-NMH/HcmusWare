// Vai trò người dùng (cột profiles.role) và quyền vào từng khu vực – Giai đoạn 2, F13.
// Ẩn menu / chặn trang chỉ để tiện cho người dùng; bảo vệ thật nằm ở RLS trong DB
// (xem supabase/migrations/20261123000000_g2_tuan1_phan_quyen.sql, kiểm thử bằng npm run test:rls).

export const ROLES = {
  customer: { label: 'Khách hàng' },
  seller: { label: 'Người bán' },
  admin: { label: 'Quản trị viên' },
}

export const ROLE_VALUES = Object.keys(ROLES)

// Ai được vào khu vực nào. Người bán có thêm mọi quyền của khách hàng (mua hàng, tài khoản).
export const AREA_ROLES = {
  account: ['customer', 'seller', 'admin'],
  seller: ['seller'],
  admin: ['admin'],
}

export function roleLabel(role) {
  return ROLES[role]?.label ?? 'Không rõ'
}

// role null/undefined (chưa đăng nhập, hồ sơ chưa tải) → không có quyền gì.
export function canAccess(role, allowed) {
  return Boolean(role) && allowed.includes(role)
}

// Lối tắt trên Header / trang Tài khoản tới khu vực riêng của vai trò (khách hàng không có).
export function roleShortcut(role) {
  if (role === 'admin') return { to: '/admin', label: 'Quản trị' }
  if (role === 'seller') return { to: '/kenh-nguoi-ban', label: 'Kênh người bán' }
  return null
}
