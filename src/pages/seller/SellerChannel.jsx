import { useAsync } from '../../hooks/useAsync'
import { useAuth } from '../../hooks/useAuth'
import { getMyShop } from '../../lib/api'

const SHOP_STATUS = {
  pending: { label: 'Chờ admin duyệt', className: 'bg-amber-50 text-amber-800' },
  active: { label: 'Đang hoạt động', className: 'bg-green-50 text-green-800' },
  locked: { label: 'Bị khóa', className: 'bg-red-50 text-red-700' },
}

// Kênh người bán /kenh-nguoi-ban. Chỉ vai trò seller vào được (RoleRoute trong App.jsx).
// Tuần 1: thông tin shop. Tuần 2: quản lý sản phẩm; Tuần 3: đơn hàng của shop.
export default function SellerChannel() {
  const { user } = useAuth()
  const shop = useAsync(() => getMyShop(user.id), [user.id])
  const status = SHOP_STATUS[shop.data?.status]

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-xl font-bold sm:text-2xl">Kênh người bán</h1>

      {shop.loading && <p className="py-8 text-center text-slate-500">Đang tải shop…</p>}
      {shop.error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          Không tải được shop: {shop.error.message}
        </p>
      )}
      {!shop.loading && !shop.error && !shop.data && (
        <p className="rounded-xl border border-slate-200 bg-surface p-5 text-sm text-slate-600">
          Tài khoản của bạn chưa có shop. Liên hệ admin để được tạo shop.
        </p>
      )}

      {shop.data && (
        <section className="space-y-2 rounded-xl border border-slate-200 bg-surface p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">{shop.data.name}</h2>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status?.className}`}>
              {status?.label ?? shop.data.status}
            </span>
          </div>
          {shop.data.description && (
            <p className="text-sm text-slate-600">{shop.data.description}</p>
          )}
          {shop.data.status === 'locked' && (
            <p className="text-sm text-red-700">
              Shop đang bị khóa: sản phẩm không hiện trên web và bạn chưa sửa được sản phẩm.
            </p>
          )}
        </section>
      )}

      <section className="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-500">
        Quản lý sản phẩm và đơn hàng của shop sẽ có trong các bản cập nhật tới.
      </section>
    </div>
  )
}
