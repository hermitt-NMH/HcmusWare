import { Link } from 'react-router-dom'
import { useAsync } from '../../hooks/useAsync'
import { getMyOrders } from '../../lib/api'
import { formatDateTime, formatPrice } from '../../lib/format'
import OrderStatusBadge from '../../components/OrderStatusBadge'
import { canPayOnline, groupOrdersByPayment, paymentStatusLabel } from './orders'

// Lịch sử đơn hàng trong trang tài khoản, mới nhất trước. Bấm vào đơn để xem chi tiết.
// Một lần đặt có hàng của nhiều shop → nhiều đơn cùng mã thanh toán, hiện chung một khung.
export default function OrderHistory({ userId }) {
  const orders = useAsync(() => getMyOrders(userId), [userId])
  const groups = groupOrdersByPayment(orders.data ?? [])

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
        {groups.map((g) =>
          g.orders.length === 1 ? (
            <li key={g.code}>
              <OrderRow order={g.orders[0]} showDate />
            </li>
          ) : (
            <li key={g.code} className="py-3">
              <div className="rounded-xl border border-slate-200">
                <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-slate-100 px-3 py-2 text-xs text-slate-500">
                  <span>
                    {formatDateTime(g.created_at)} · Mã thanh toán {g.code} · {g.orders.length} đơn
                    từ {g.orders.length} shop
                  </span>
                  <span className="text-sm font-semibold text-slate-900">
                    {formatPrice(g.total)}
                  </span>
                </p>
                <ul className="divide-y divide-slate-100 px-2">
                  {g.orders.map((o) => (
                    <li key={o.id}>
                      <OrderRow order={o} />
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          ),
        )}
      </ul>
    </section>
  )
}

// showDate: đơn đứng riêng thì hiện ngày đặt; đơn trong nhóm đã có ngày ở đầu khung.
function OrderRow({ order: o, showDate = false }) {
  const count = (o.order_items ?? []).reduce((sum, it) => sum + it.quantity, 0)
  return (
    <Link
      to={`/don-hang/${o.id}`}
      className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 hover:bg-slate-50"
    >
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2">
          <span className="font-medium">#{o.id}</span>
          <OrderStatusBadge status={o.status} />
          {o.shops && <span className="truncate text-sm text-slate-600">{o.shops.name}</span>}
        </p>
        <p className="text-xs text-slate-500">
          {showDate && `${formatDateTime(o.created_at)} · `}
          {count} sản phẩm ·{' '}
          <span className={canPayOnline(o) ? 'font-medium text-amber-700 dark:text-amber-300' : ''}>
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
  )
}
