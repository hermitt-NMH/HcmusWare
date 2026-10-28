import { Link, Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useAsync } from '../hooks/useAsync'
import { getOrderById } from '../lib/api'
import { formatDateTime, formatPrice } from '../lib/format'
import { categoryImage, thumbUrl } from '../lib/images'
import OrderStatusBadge from '../components/OrderStatusBadge'
import {
  ORDER_STATUS,
  PAYMENT_METHODS,
  canPayOnline,
  paymentStatusLabel,
} from '../features/orders/orders'
import NotFound from './NotFound'

const STEPS = ['pending', 'confirmed', 'shipping', 'completed']

// Chi tiết một đơn hàng của khách: trạng thái, thanh toán, địa chỉ, từng sản phẩm.
// ?moi=1: vừa đặt xong → hiện lời cảm ơn.
export default function OrderDetail() {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <p className="py-16 text-center text-slate-500">Đang kiểm tra đăng nhập…</p>
  if (!user)
    return <Navigate to={`/dang-nhap?next=${encodeURIComponent(location.pathname)}`} replace />
  return <OrderView />
}

function OrderView() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const order = useAsync(() => getOrderById(id), [id])

  if (order.loading) return <p className="py-16 text-center text-slate-500">Đang tải đơn hàng…</p>
  if (order.error)
    return (
      <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
        Không tải được đơn hàng: {order.error.message}
      </p>
    )
  // Không tồn tại hoặc không phải đơn của mình (RLS) → 404.
  if (!order.data) return <NotFound />

  const o = order.data
  const isNew = params.get('moi') === '1'
  const stepIndex = STEPS.indexOf(o.status)

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {isNew && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-green-900">
          <p className="text-lg font-semibold">✓ Đặt hàng thành công!</p>
          <p className="text-sm">
            Cảm ơn bạn. Mã đơn của bạn là <strong>#{o.id}</strong>. Shop sẽ gọi xác nhận trong giờ
            hành chính.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Đơn hàng #{o.id}</h1>
          <p className="text-sm text-slate-500">Đặt lúc {formatDateTime(o.created_at)}</p>
        </div>
        <OrderStatusBadge status={o.status} />
      </div>

      {/* Tiến trình đơn (ẩn khi đã hủy) */}
      {o.status !== 'cancelled' && (
        <ol className="grid grid-cols-4 gap-1 text-center text-[11px] sm:text-xs">
          {STEPS.map((s, i) => (
            <li key={s} className="space-y-1">
              <div
                className={`h-1.5 rounded-full ${i <= stepIndex ? 'bg-blue-600' : 'bg-slate-200'}`}
              />
              <span className={i <= stepIndex ? 'font-medium text-slate-900' : 'text-slate-500'}>
                {ORDER_STATUS[s].label}
              </span>
            </li>
          ))}
        </ol>
      )}

      {canPayOnline(o) && (
        <div className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-amber-900">Đơn hàng đang chờ bạn thanh toán online.</p>
          <Link
            to={`/thanh-toan/mo-phong/${o.id}`}
            className="inline-flex h-11 items-center justify-center rounded-lg bg-blue-600 px-5 font-semibold text-white hover:bg-blue-700"
          >
            Thanh toán ngay
          </Link>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-surface p-4 text-sm">
          <h2 className="mb-2 font-semibold">Giao đến</h2>
          <p className="font-medium">{o.shipping_name}</p>
          <p>{o.shipping_phone}</p>
          <p className="whitespace-pre-line text-slate-600">{o.shipping_address}</p>
          {o.note && <p className="mt-2 text-slate-500">Ghi chú: {o.note}</p>}
        </section>
        <section className="rounded-xl border border-slate-200 bg-surface p-4 text-sm">
          <h2 className="mb-2 font-semibold">Thanh toán</h2>
          <p>{PAYMENT_METHODS[o.payment_method]?.label ?? o.payment_method}</p>
          <p
            className={
              o.paid_at ? 'font-medium text-green-700 dark:text-green-400' : 'text-slate-600'
            }
          >
            {paymentStatusLabel(o)}
            {o.paid_at && ` lúc ${formatDateTime(o.paid_at)}`}
          </p>
        </section>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-surface">
        <ul className="divide-y divide-slate-100">
          {o.order_items.map((it) => {
            const fallback = categoryImage(it.products?.categories?.slug)
            return (
              <li key={it.id} className="flex items-center gap-3 p-3 text-sm">
                <img
                  src={thumbUrl(it.products?.image_url) || fallback}
                  alt=""
                  loading="lazy"
                  className="h-14 w-14 shrink-0 rounded-md border border-slate-100 object-contain"
                />
                <span className="min-w-0 flex-1">
                  <Link
                    to={`/san-pham/${it.product_id}`}
                    className="line-clamp-2 hover:text-blue-700 dark:hover:text-blue-300"
                  >
                    {it.products?.name ?? `Sản phẩm #${it.product_id}`}
                  </Link>
                  <span className="text-xs text-slate-500">
                    {formatPrice(it.unit_price)} × {it.quantity}
                  </span>
                </span>
                <span className="shrink-0 font-medium">
                  {formatPrice(it.unit_price * it.quantity)}
                </span>
              </li>
            )
          })}
        </ul>
        <div className="flex items-baseline justify-between border-t border-slate-200 p-4">
          <span className="font-medium">Tổng cộng</span>
          <span className="text-xl font-bold text-red-600 dark:text-red-400">
            {formatPrice(o.total)}
          </span>
        </div>
      </section>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Link
          to="/tai-khoan"
          className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-300 bg-surface px-5 text-sm font-medium hover:bg-slate-50"
        >
          Xem tất cả đơn hàng
        </Link>
        <Link
          to="/san-pham"
          className="inline-flex h-11 items-center justify-center rounded-lg px-5 text-sm text-blue-700 dark:text-blue-300 hover:underline"
        >
          Tiếp tục mua sắm
        </Link>
      </div>
    </div>
  )
}
