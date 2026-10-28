import { Link } from 'react-router-dom'
import { useAsync } from '../../hooks/useAsync'
import { useAuth } from '../../hooks/useAuth'
import { getMyShop } from '../../lib/api'
import { SHOP_STATUS } from './shopForm'

const button =
  'inline-flex h-10 items-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700'

// Mục "Shop của tôi" ở /tai-khoan (US-14.1, US-14.2):
// chưa có shop → nút "Mở shop"; chờ duyệt → thông báo; bị từ chối → lý do + "Sửa và gửi lại";
// vừa được duyệt mà hồ sơ trên máy còn vai trò cũ → nút tải lại để hiện Kênh người bán.
// Admin là chủ shop HcmusWare nên không bao giờ thấy nút "Mở shop" (C5).
export default function MyShopCard() {
  const { user, role, reloadProfile } = useAuth()
  const shop = useAsync(() => getMyShop(user.id), [user.id])

  if (shop.loading || shop.error) return null
  const s = shop.data
  // Người bán có shop đang hoạt động: lối tắt "Vào kênh người bán" ở trên đã đủ.
  if (s?.status === 'active' && role === 'seller') return null
  if (role === 'admin') return null

  return (
    <section className="space-y-2 rounded-2xl border border-slate-200 bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">
          {s ? `Shop “${s.name}”` : 'Bán hàng trên HcmusWare'}
        </h2>
        {s && (
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${SHOP_STATUS[s.status]?.className}`}
          >
            {SHOP_STATUS[s.status]?.label}
          </span>
        )}
      </div>

      {!s && (
        <>
          <p className="text-sm text-slate-600">
            Mở shop để đăng bán linh kiện. Admin duyệt shop trước khi bạn đăng sản phẩm.
          </p>
          <Link to="/tai-khoan/mo-shop" className={button}>
            Mở shop
          </Link>
        </>
      )}
      {s?.status === 'pending' && (
        <p className="text-sm text-slate-600">
          Shop “{s.name}” đang chờ admin duyệt.{' '}
          <Link
            to="/tai-khoan/mo-shop"
            className="text-blue-700 underline hover:no-underline dark:text-blue-300"
          >
            Sửa thông tin
          </Link>
        </p>
      )}
      {s?.status === 'rejected' && (
        <>
          <p className="text-sm text-red-700">
            Lý do từ chối: <span className="whitespace-pre-line">{s.review_note}</span>
          </p>
          <Link to="/tai-khoan/mo-shop" className={button}>
            Sửa và gửi lại
          </Link>
        </>
      )}
      {s?.status === 'active' && (
        <>
          <p className="text-sm text-slate-600">
            Shop đã được duyệt. Tải lại để vào Kênh người bán.
          </p>
          <button type="button" onClick={reloadProfile} className={button}>
            Tải lại quyền
          </button>
        </>
      )}
      {s?.status === 'locked' && (
        <p className="text-sm text-red-700">Shop đang bị khóa. Liên hệ admin để biết thêm.</p>
      )}
    </section>
  )
}
