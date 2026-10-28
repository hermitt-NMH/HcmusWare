import { Link } from 'react-router-dom'
import { useAsync } from '../../hooks/useAsync'
import { getMyOrders } from '../../lib/api'
import { formatDateTime, formatPrice } from '../../lib/format'
import OrderStatusBadge from '../../components/OrderStatusBadge'
import { canPayOnline, paymentStatusLabel } from './orders'

// Lịch sử đơn hàng trong trang tài khoản, mới nhất trước. Bấm vào đơn để xem chi tiết.
export default function OrderHistory({ userId }) {
  const orders = useAsync(() => getMyOrders(userId), [userId])

  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-surface p-5 sm:p-6">
      <h2 className="text-lg font-semibold">Đơn hàng của tôi</h2>
      {orders.loading && <p className="text-sm text-slate-500">Đang tải…</p>}
      {orders.error && (
        <p className="text-sm text-red-600 dark:text-red-400">
          Không tải được đơn hàng: {orders.error.message}
        </p>
      )}
      {orders.data && !orders.data.length && (
        <p className="text-sm text-slate-500">
          Bạn chưa có đơn hàng nào.{' '}
          <Link to="/san-pham" className="text-blue-700 dark:text-blue-300 hover:underline">
            Mua sắm ngay
          </Link>
        </p>
      )}
      <ul className="divide-y divide-slate-100">
        {orders.data?.map((o) => {
          const count = o.order_items.reduce((sum, it) => sum + it.quantity, 0)
          return (
            <li key={o.id}>
              <Link
                to={`/don-hang/${o.id}`}
                className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 hover:bg-slate-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">#{o.id}</span>
                    <OrderStatusBadge status={o.status} />
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatDateTime(o.created_at)} · {count} sản phẩm ·{' '}
                    <span
                      className={
                        canPayOnline(o) ? 'font-medium text-amber-700 dark:text-amber-300' : ''
                      }
                    >
                      {paymentStatusLabel(o)}
                    </span>
                  </p>
                </div>
                <span className="shrink-0 font-semibold text-red-600 dark:text-red-400">
                  {formatPrice(o.total)}
                </span>
                <span aria-hidden="true" className="text-slate-500">
                  ›
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
