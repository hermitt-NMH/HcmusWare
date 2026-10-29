import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useAsync } from '../hooks/useAsync'
import { getMyOrdersByPaymentCode, getOrderById, mockPayOrder } from '../lib/api'
import { formatPrice } from '../lib/format'
import { amountToPay, canPayOnline, orderErrorMessage } from '../features/orders/orders'
import NotFound from './NotFound'

// Cổng thanh toán MÔ PHỎNG: giả màn hình ngân hàng/ví, không trừ tiền thật.
// Bấm "Thanh toán" → hàm mock_pay_order trong DB đánh dấu đơn đã trả và chuyển "Đã xác nhận".
// Thanh toán thật (VNPay sandbox) cần Supabase Edge Function – để ở mục "nếu dư thời gian".
// Giỏ nhiều shop → nhiều đơn cùng mã thanh toán: trả một lần cho mọi đơn còn chờ trả trong nhóm.
export default function MockPayment() {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <p className="py-16 text-center text-slate-500">Đang kiểm tra đăng nhập…</p>
  if (!user)
    return <Navigate to={`/dang-nhap?next=${encodeURIComponent(location.pathname)}`} replace />
  return <PaymentView />
}

function PaymentView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const order = useAsync(async () => {
    const o = await getOrderById(id)
    if (!o) return null
    const group = o.payment_code ? await getMyOrdersByPaymentCode(user.id, o.payment_code) : []
    return { ...o, group: group.length ? group : [o] }
  }, [id, user.id])
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState('')

  if (order.loading) return <p className="py-16 text-center text-slate-500">Đang tải đơn hàng…</p>
  if (order.error)
    return (
      <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
        Không tải được đơn hàng: {order.error.message}
      </p>
    )
  if (!order.data) return <NotFound />
  const o = order.data
  // Đã trả / đã hủy / đơn COD → về trang đơn hàng.
  if (!canPayOnline(o)) return <Navigate to={`/don-hang/${o.id}`} replace />
  const payable = o.group.filter(canPayOnline)
  const amount = amountToPay(o.group)

  const pay = async () => {
    setPaying(true)
    setError('')
    try {
      await mockPayOrder(o.id)
      navigate(`/don-hang/${o.id}?moi=1`, { replace: true })
    } catch (err) {
      setError(orderErrorMessage(err))
      setPaying(false)
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4 py-4">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-surface shadow-sm">
        <div className="bg-gray-900 px-5 py-4 text-white">
          <p className="text-xs uppercase tracking-wide text-gray-300">
            Cổng thanh toán thử nghiệm
          </p>
          <p className="text-lg font-semibold">HcmusPay</p>
        </div>
        <div className="space-y-4 p-5">
          <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
            Đây là thanh toán <strong>mô phỏng</strong> cho đồ án, không trừ tiền thật và không cần
            nhập thẻ.
          </p>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Đơn vị nhận</dt>
              <dd className="font-medium">HcmusWare</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">
                {payable.length > 1 ? 'Mã thanh toán' : 'Mã đơn hàng'}
              </dt>
              <dd className="font-medium">{payable.length > 1 ? o.payment_code : `#${o.id}`}</dd>
            </div>
            {payable.length > 1 && (
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Gồm các đơn</dt>
                <dd className="text-right font-medium">
                  {payable.map((x) => `#${x.id}`).join(', ')}
                </dd>
              </div>
            )}
            <div className="flex items-baseline justify-between gap-2 border-t border-slate-100 pt-2">
              <dt className="text-slate-500">Số tiền</dt>
              <dd className="text-2xl font-bold text-red-600 dark:text-red-400">
                {formatPrice(amount)}
              </dd>
            </div>
          </dl>
          {error && (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={pay}
            disabled={paying}
            className="h-12 w-full rounded-lg bg-green-600 font-semibold text-white hover:bg-green-700 disabled:opacity-60"
          >
            {paying ? 'Đang xử lý…' : `Thanh toán ${formatPrice(amount)}`}
          </button>
          <Link
            to={`/don-hang/${o.id}`}
            className="flex min-h-11 items-center justify-center text-sm text-slate-500 hover:text-slate-800"
          >
            Để sau (đơn vẫn được giữ, thanh toán lại trong mục Đơn hàng)
          </Link>
        </div>
      </div>
    </div>
  )
}
