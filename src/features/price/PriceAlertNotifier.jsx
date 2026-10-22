import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { getMyPriceAlerts, markAlertsNotified } from '../../lib/api'
import { formatPrice } from '../../lib/format'
import { ALERTS_CHANGED, isAlertTriggered } from './price'

// Thanh thông báo "Giá đã giảm" dưới Header. Kiểm tra lại mỗi khi khách chuyển trang,
// quay lại tab, hoặc vừa đặt/xóa cảnh báo. Bấm "Đã xem" thì không báo lại (notified = true)
// cho tới khi khách đặt giá mong muốn mới.
export default function PriceAlertNotifier() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const [reload, setReload] = useState(0)

  useEffect(() => {
    const bump = () => setReload((n) => n + 1)
    window.addEventListener(ALERTS_CHANGED, bump)
    window.addEventListener('focus', bump)
    return () => {
      window.removeEventListener(ALERTS_CHANGED, bump)
      window.removeEventListener('focus', bump)
    }
  }, [])

  // Không dùng useAsync: nó xóa dữ liệu cũ mỗi lần đổi trang làm thanh thông báo nháy.
  // Ở đây giữ danh sách cũ cho tới khi có danh sách mới.
  const userId = user?.id
  const [alerts, setAlerts] = useState([])
  useEffect(() => {
    if (!userId) {
      setAlerts([])
      return
    }
    let cancelled = false
    getMyPriceAlerts()
      .then((data) => !cancelled && setAlerts(data))
      .catch(() => {}) // lỗi mạng: giữ danh sách cũ, lần chuyển trang sau thử lại
    return () => {
      cancelled = true
    }
  }, [userId, pathname, reload])
  const [dismissed, setDismissed] = useState([]) // id đã bấm "Đã xem" trong phiên này

  const triggered = alerts.filter((a) => isAlertTriggered(a) && !dismissed.includes(a.id))
  if (!triggered.length) return null

  const dismiss = () => {
    const ids = triggered.map((a) => a.id)
    setDismissed((d) => [...d, ...ids])
    markAlertsNotified(ids).catch(() => {}) // lỗi mạng: lần sau mở web sẽ báo lại, không sao
  }

  const shown = triggered.slice(0, 3)
  return (
    <div role="status" className="border-b border-green-200 bg-green-50">
      <div className="mx-auto flex max-w-6xl items-start gap-3 px-4 py-2 text-sm text-green-900">
        <span aria-hidden="true" className="pt-0.5">
          🔔
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Giá đã giảm tới mức bạn mong muốn!</p>
          <ul className="space-y-0.5">
            {shown.map((a) => (
              <li key={a.id}>
                <Link
                  to={`/san-pham/${a.product_id}`}
                  className="font-medium underline-offset-2 hover:underline"
                >
                  {a.products.name}
                </Link>{' '}
                chỉ còn <strong>{formatPrice(a.products.price)}</strong>{' '}
                <span className="text-green-800/80">
                  (bạn muốn ≤ {formatPrice(a.target_price)})
                </span>
              </li>
            ))}
          </ul>
          {triggered.length > shown.length && (
            <Link to="/tai-khoan#canh-bao-gia" className="text-xs underline">
              và {triggered.length - shown.length} sản phẩm khác
            </Link>
          )}
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="inline-flex h-10 shrink-0 items-center rounded-lg px-3 font-medium hover:bg-green-100"
        >
          Đã xem
        </button>
      </div>
    </div>
  )
}
