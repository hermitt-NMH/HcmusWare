import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAsync } from '../../hooks/useAsync'
import { deletePriceAlert, getMyPriceAlerts } from '../../lib/api'
import { formatPrice } from '../../lib/format'
import { ALERTS_CHANGED } from './price'
import { t } from '../../lib/i18n'

// Danh sách cảnh báo giá trong trang tài khoản. Sửa giá mong muốn ở trang sản phẩm.
export default function MyPriceAlerts({ userId }) {
  const alerts = useAsync(() => getMyPriceAlerts(), [userId])
  const [deleted, setDeleted] = useState([])
  const [error, setError] = useState('')

  const remove = async (id) => {
    setError('')
    try {
      await deletePriceAlert(id)
      setDeleted((d) => [...d, id])
      window.dispatchEvent(new Event(ALERTS_CHANGED))
    } catch (err) {
      setError(t('Không xóa được: {msg}', { msg: t(err.message) }))
    }
  }

  const list = alerts.data?.filter((a) => !deleted.includes(a.id)) ?? []

  return (
    <section
      id="canh-bao-gia"
      className="scroll-mt-36 space-y-3 rounded-2xl border border-slate-200 bg-surface p-5 sm:p-6"
    >
      <h2 className="text-lg font-semibold">{t('Cảnh báo giá')}</h2>
      {alerts.loading && <p className="text-sm text-slate-500">{t('Đang tải…')}</p>}
      {alerts.error && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {t('Không tải được: {msg}', { msg: t(alerts.error.message) })}
        </p>
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {!alerts.loading && !alerts.error && !list.length && (
        <p className="text-sm text-slate-500">
          {t(
            'Chưa có cảnh báo nào. Mở trang một sản phẩm và đặt "giá mong muốn" để được báo khi giảm giá.',
          )}
        </p>
      )}
      <ul className="divide-y divide-slate-100">
        {list.map((a) => {
          const reached = a.products.price <= a.target_price
          return (
            <li key={a.id} className="flex items-center gap-3 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <Link
                  to={`/san-pham/${a.product_id}`}
                  className="line-clamp-1 font-medium hover:text-blue-700 dark:hover:text-blue-300"
                >
                  {a.products.name}
                </Link>
                <p className="text-xs text-slate-500">
                  {t('Hiện tại {now} · mong muốn ≤ {target}', {
                    now: formatPrice(a.products.price),
                    target: formatPrice(a.target_price),
                  })}
                </p>
                {reached && (
                  <p className="text-xs font-medium text-green-700 dark:text-green-400">
                    {t('✓ Đã đạt giá')}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => remove(a.id)}
                className="inline-flex h-10 shrink-0 items-center rounded-lg px-3 text-slate-500 hover:bg-slate-100 hover:text-red-600 dark:hover:text-red-400"
              >
                {t('Xóa')}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
