import { ORDER_STATUS } from '../features/orders/orders'

// Nhãn màu cho trạng thái đơn hàng (Chờ xác nhận, Đang giao...).
export default function OrderStatusBadge({ status }) {
  const s = ORDER_STATUS[status] ?? { label: status, className: 'bg-slate-100 text-slate-700' }
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.className}`}
    >
      {s.label}
    </span>
  )
}
