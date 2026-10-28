import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { useAsync } from '../../hooks/useAsync'
import { useAuth } from '../../hooks/useAuth'
import { getMyShop } from '../../lib/api'
import { SHOP_STATUS } from '../../features/seller/shopForm'
import LogoBadge from '../../components/LogoBadge'
import SellerProducts from './SellerProducts'
import SellerProductForm from './SellerProductForm'

// Kênh người bán /kenh-nguoi-ban. Chỉ vai trò seller vào được (RoleRoute trong App.jsx).
// /kenh-nguoi-ban                 – thông tin shop + danh sách sản phẩm
// /kenh-nguoi-ban/san-pham/moi    – đăng sản phẩm
// /kenh-nguoi-ban/san-pham/:id    – sửa sản phẩm
// Tuần 3: đơn hàng của shop.
export default function SellerChannel() {
  const { user } = useAuth()
  const shop = useAsync(() => getMyShop(user.id), [user.id])

  if (shop.loading) return <p className="py-16 text-center text-slate-500">Đang tải shop…</p>
  if (shop.error)
    return (
      <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
        Không tải được shop: {shop.error.message}
      </p>
    )
  if (!shop.data)
    return (
      <div className="mx-auto max-w-3xl space-y-3">
        <h1 className="text-xl font-bold sm:text-2xl">Kênh người bán</h1>
        <p className="rounded-xl border border-slate-200 bg-surface p-5 text-sm text-slate-600">
          Tài khoản của bạn chưa có shop.{' '}
          <Link
            to="/tai-khoan/mo-shop"
            className="text-blue-700 underline hover:no-underline dark:text-blue-300"
          >
            Đăng ký mở shop
          </Link>
        </p>
      </div>
    )

  // Chỉ shop đang hoạt động mới thêm/sửa sản phẩm được (DB cũng chặn: can_manage_shop).
  const canEdit = shop.data.status === 'active'
  return (
    <Routes>
      <Route index element={<SellerHome shop={shop.data} canEdit={canEdit} />} />
      <Route
        path="san-pham/moi"
        element={
          canEdit ? (
            <SellerProductForm shop={shop.data} />
          ) : (
            <Navigate to="/kenh-nguoi-ban" replace />
          )
        }
      />
      <Route
        path="san-pham/:id"
        element={
          canEdit ? (
            <SellerProductForm shop={shop.data} />
          ) : (
            <Navigate to="/kenh-nguoi-ban" replace />
          )
        }
      />
      <Route path="*" element={<Navigate to="/kenh-nguoi-ban" replace />} />
    </Routes>
  )
}

function SellerHome({ shop, canEdit }) {
  const status = SHOP_STATUS[shop.status]
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <h1 className="text-xl font-bold sm:text-2xl">Kênh người bán</h1>

      <section className="flex items-start gap-4 rounded-xl border border-slate-200 bg-surface p-5">
        <LogoBadge name={shop.name} url={shop.logo_url} size="h-16 w-16" text="text-2xl" />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">{shop.name}</h2>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status?.className}`}>
              {status?.label ?? shop.status}
            </span>
          </div>
          {shop.description && (
            <p className="line-clamp-3 whitespace-pre-line text-sm text-slate-600">
              {shop.description}
            </p>
          )}
          {shop.status === 'active' && (
            <Link
              to={`/shop/${shop.slug}`}
              className="inline-flex min-h-11 items-center text-sm text-blue-700 underline hover:no-underline dark:text-blue-300"
            >
              Xem trang shop
            </Link>
          )}
          {shop.status === 'locked' && (
            <p className="text-sm text-red-700">
              Shop đang bị khóa: sản phẩm không hiện trên web và bạn chưa sửa được sản phẩm.
            </p>
          )}
        </div>
      </section>

      <SellerProducts shop={shop} canEdit={canEdit} />
    </div>
  )
}
