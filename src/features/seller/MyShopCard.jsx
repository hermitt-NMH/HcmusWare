import { Link } from 'react-router-dom'
import { useAsync } from '../../hooks/useAsync'
import { useAuth } from '../../hooks/useAuth'
import { getMyShop } from '../../lib/api'
import { SHOP_STATUS } from './shopForm'
import { t } from '../../lib/i18n'

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
          {s ? t('Shop “{name}”', { name: s.name }) : t('Bán hàng trên HcmusWare')}
        </h2>
        {s && (
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${SHOP_STATUS[s.status]?.className}`}
          >
            {t(SHOP_STATUS[s.status]?.label)}
          </span>
        )}
      </div>

      {!s && (
        <>
          <p className="text-sm text-slate-600">
            {t('Mở shop để đăng bán linh kiện. Admin duyệt shop trước khi bạn đăng sản phẩm.')}
          </p>
          <Link to="/tai-khoan/mo-shop" className={button}>
            {t('Mở shop')}
          </Link>
        </>
      )}
      {s?.status === 'pending' && (
        <p className="text-sm text-slate-600">
          {t('Shop “{name}” đang chờ admin duyệt.', { name: s.name })}{' '}
          <Link
            to="/tai-khoan/mo-shop"
            className="text-blue-700 underline hover:no-underline dark:text-blue-300"
          >
            {t('Sửa thông tin')}
          </Link>
        </p>
      )}
      {s?.status === 'rejected' && (
        <>
          <p className="text-sm text-red-700">
            {t('Lý do từ chối:')} <span className="whitespace-pre-line">{s.review_note}</span>
          </p>
          <Link to="/tai-khoan/mo-shop" className={button}>
            {t('Sửa và gửi lại')}
          </Link>
        </>
      )}
      {s?.status === 'active' && (
        <>
          <p className="text-sm text-slate-600">
            {t('Shop đã được duyệt. Tải lại để vào Kênh người bán.')}
          </p>
          <button type="button" onClick={reloadProfile} className={button}>
            {t('Tải lại quyền')}
          </button>
        </>
      )}
      {s?.status === 'locked' && (
        <p className="text-sm text-red-700">
          {t('Shop đang bị khóa. Liên hệ admin để biết thêm.')}
        </p>
      )}
    </section>
  )
}
