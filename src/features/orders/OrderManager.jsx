import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAsync } from '../../hooks/useAsync'
import { updateOrderStatus } from '../../lib/api'
import { formatDateTime, formatPrice } from '../../lib/format'
import OrderStatusBadge from '../../components/OrderStatusBadge'
import {
  ORDER_STATUS,
  PAYMENT_METHODS,
  canPayOnline,
  isFinalStatus,
  nextStatuses,
  orderErrorMessage,
  paymentStatusLabel,
} from './orders'

// Quản lý đơn hàng (trang admin và kênh người bán): lọc theo trạng thái, xem sản phẩm, đổi trạng thái.
// Hủy đơn → trigger trong DB trả hàng về kho. Đơn hoàn tất / đã hủy thì khóa; trạng thái chỉ đi tới.
// load: hàm tải đơn (getAdminOrders / getShopOrders); loadKey: đổi thì tải lại (vd id shop).
// showShop: hiện tên shop của đơn (admin xem đơn của mọi shop).
// readOnly: chỉ xem, không đổi trạng thái (shop bị khóa – DB cũng chặn).
export default function OrderManager({ load, loadKey = '', showShop = false, readOnly = false }) {
  const [reload, setReload] = useState(0)
  const orders = useAsync(load, [loadKey, reload])
  const [filter, setFilter] = useState('')
  const [changed, setChanged] = useState({}) // id → đơn sau khi đổi trạng thái (khỏi tải lại cả list)

  const all = (orders.data ?? []).map((o) => ({ ...o, ...changed[o.id] }))
  const counts = all.reduce((c, o) => ({ ...c, [o.status]: (c[o.status] ?? 0) + 1 }), {})
  const list = filter ? all.filter((o) => o.status === filter) : all

  const chip = (value, label, count) => (
    <button
      key={value || 'all'}
      type="button"
      onClick={() => setFilter(value)}
      aria-pressed={filter === value}
      className={`inline-flex h-10 shrink-0 items-center gap-1 rounded-full border px-3 text-sm ${
        filter === value
          ? 'border-gray-900 bg-gray-900 text-white dark:border-blue-600 dark:bg-blue-600'
          : 'border-slate-300 bg-surface text-slate-700 hover:bg-slate-50'
      }`}
    >
      {label}
      <span className="text-xs opacity-70">{count ?? 0}</span>
    </button>
  )

  return (
    <div className="space-y-3">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {chip('', 'Tất cả', all.length)}
        {Object.entries(ORDER_STATUS).map(([value, s]) => chip(value, s.label, counts[value]))}
        <button
          type="button"
          onClick={() => {
            setChanged({})
            setReload((n) => n + 1)
          }}
          className="ml-auto inline-flex h-10 shrink-0 items-center rounded-lg px-3 text-sm text-blue-700 dark:text-blue-300 hover:bg-blue-50"
        >
          Tải lại
        </button>
      </div>

      {orders.loading && <p className="py-8 text-center text-slate-500">Đang tải đơn hàng…</p>}
      {orders.error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          Không tải được: {orders.error.message}
        </p>
      )}
      {orders.data && !list.length && (
        <p className="py-8 text-center text-sm text-slate-500">Không có đơn nào.</p>
      )}

      <ul className="space-y-3">
        {list.map((o) => (
          <OrderCard
            key={o.id}
            order={o}
            showShop={showShop}
            readOnly={readOnly}
            onUpdated={(updated) => setChanged((c) => ({ ...c, [o.id]: updated }))}
          />
        ))}
      </ul>
    </div>
  )
}

function OrderCard({ order: o, showShop, readOnly, onUpdated }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const count = o.order_items.reduce((sum, it) => sum + it.quantity, 0)

  const change = async (status) => {
    if (status === o.status) return
    if (
      status === 'cancelled' &&
      !window.confirm(`Hủy đơn #${o.id}? Hàng sẽ được trả về kho và không đổi lại được.`)
    )
      return
    if (status === 'completed' && !window.confirm(`Đánh dấu đơn #${o.id} đã hoàn tất?`)) return
    setSaving(true)
    setError('')
    try {
      onUpdated(await updateOrderStatus(o.id, status))
    } catch (err) {
      setError(orderErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <li className="rounded-xl border border-slate-200 bg-surface p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">#{o.id}</span>
            <OrderStatusBadge status={o.status} />
          </p>
          <p className="text-xs text-slate-500">
            {formatDateTime(o.created_at)}
            {o.payment_code && ` · Mã thanh toán ${o.payment_code}`}
          </p>
          {showShop && o.shops && (
            <p className="text-xs text-slate-600">
              Shop{' '}
              <Link
                to={`/shop/${o.shops.slug}`}
                className="font-medium text-blue-700 hover:underline dark:text-blue-300"
              >
                {o.shops.name}
              </Link>
            </p>
          )}
        </div>
        <p className="text-lg font-bold text-red-600 dark:text-red-400">{formatPrice(o.total)}</p>
      </div>

      <div className="mt-2 grid gap-1 sm:grid-cols-2">
        <p>
          <span className="font-medium">{o.shipping_name}</span> · {o.shipping_phone}
          <span className="block text-slate-600">{o.shipping_address}</span>
          {o.note && <span className="block text-slate-500">Ghi chú: {o.note}</span>}
        </p>
        <p className="text-slate-600 sm:text-right">
          {PAYMENT_METHODS[o.payment_method]?.short} ·{' '}
          <span className={o.paid_at ? 'font-medium text-green-700 dark:text-green-400' : ''}>
            {paymentStatusLabel(o)}
          </span>
        </p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="inline-flex h-10 items-center rounded-lg px-2 text-blue-700 dark:text-blue-300 hover:bg-blue-50"
        >
          {open ? 'Ẩn' : 'Xem'} {count} sản phẩm
        </button>
        <label className="ml-auto inline-flex items-center gap-2">
          <span className="text-slate-500">Trạng thái</span>
          <select
            value={o.status}
            disabled={saving || readOnly || isFinalStatus(o.status)}
            onChange={(e) => change(e.target.value)}
            className="h-10 rounded-lg border border-slate-300 bg-surface px-2 disabled:bg-slate-100"
          >
            {nextStatuses(o.status, canPayOnline(o)).map((s) => (
              <option key={s} value={s}>
                {ORDER_STATUS[s].label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && <p className="mt-2 text-red-600 dark:text-red-400">{error}</p>}

      {open && (
        <ul className="mt-2 divide-y divide-slate-100 rounded-lg bg-slate-50 px-3">
          {o.order_items.map((it) => (
            <li key={it.id} className="flex justify-between gap-2 py-2">
              <span className="min-w-0">
                {it.products?.name ?? 'Sản phẩm đã xóa'} × {it.quantity}
              </span>
              <span className="shrink-0">{formatPrice(it.unit_price * it.quantity)}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}
