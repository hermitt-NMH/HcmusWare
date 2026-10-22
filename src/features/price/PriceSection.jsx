import { Suspense, lazy, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useAsync } from '../../hooks/useAsync'
import { deletePriceAlert, getMyPriceAlert, getPriceHistory, upsertPriceAlert } from '../../lib/api'
import { formatDate, formatPrice } from '../../lib/format'
import {
  ALERTS_CHANGED,
  parsePriceInput,
  summarizeHistory,
  validateTargetPrice,
  withCurrentPrice,
} from './price'

// Chart.js khá nặng (~60 KB) → chỉ tải khi mở trang sản phẩm, không làm chậm trang chủ.
const PriceChart = lazy(() => import('./PriceChart'))

// Mục "Lịch sử giá" trên trang sản phẩm: biểu đồ 6 tháng, thấp/cao nhất, đặt giá mong muốn.
export default function PriceSection({ productId, currentPrice }) {
  const history = useAsync(() => getPriceHistory(productId), [productId])
  const { user } = useAuth()
  const alert = useAsync(
    () => (user ? getMyPriceAlert(productId) : Promise.resolve(null)),
    [productId, user?.id ?? ''],
  )
  // Cảnh báo sau khi khách sửa (undefined = chưa sửa, dùng dữ liệu tải từ DB).
  const [edited, setEdited] = useState(undefined)
  const myAlert = edited === undefined ? alert.data : edited
  const [showTable, setShowTable] = useState(false)

  const points = withCurrentPrice(history.data, currentPrice)
  const stats = summarizeHistory(points)

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Lịch sử giá 6 tháng</h2>
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          {history.loading && (
            <div className="h-56 animate-pulse rounded-lg bg-slate-100 sm:h-64" />
          )}
          {history.error && (
            <p className="text-sm text-red-600">
              Không tải được lịch sử giá: {history.error.message}
            </p>
          )}
          {!history.loading && !history.error && stats && (
            <>
              <dl className="grid grid-cols-3 gap-2 text-center text-sm">
                <Stat label="Thấp nhất" value={formatPrice(stats.min)} />
                <Stat label="Cao nhất" value={formatPrice(stats.max)} />
                <Stat
                  label="So với 6 tháng trước"
                  value={`${stats.changePct > 0 ? '+' : ''}${stats.changePct.toLocaleString('vi-VN')}%`}
                  className={
                    stats.changePct < 0
                      ? 'text-green-700'
                      : stats.changePct > 0
                        ? 'text-red-600'
                        : ''
                  }
                />
              </dl>
              {points.length > 1 ? (
                <Suspense fallback={<div className="h-56 rounded-lg bg-slate-50 sm:h-64" />}>
                  <PriceChart points={points} targetPrice={myAlert?.target_price} />
                </Suspense>
              ) : (
                <p className="py-6 text-center text-sm text-slate-500">
                  Giá chưa thay đổi trong 6 tháng qua.
                </p>
              )}
              {myAlert && (
                <p className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="inline-block w-5 border-t-2 border-dashed border-green-600" />
                  Giá mong muốn của bạn
                </p>
              )}
              {/* Bảng cho người không xem được biểu đồ (trình đọc màn hình) */}
              <button
                type="button"
                onClick={() => setShowTable((v) => !v)}
                aria-expanded={showTable}
                className="min-h-11 text-sm text-blue-700 hover:underline"
              >
                {showTable ? 'Ẩn bảng giá' : 'Xem dạng bảng'}
              </button>
              {showTable && (
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-slate-500">
                    <tr>
                      <th className="py-1 font-medium">Từ ngày</th>
                      <th className="py-1 text-right font-medium">Giá</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...points].reverse().map((p) => (
                      <tr key={p.recorded_at} className="border-t border-slate-100">
                        <td className="py-1.5">{formatDate(p.recorded_at)}</td>
                        <td className="py-1.5 text-right">{formatPrice(p.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>

        <PriceAlertBox
          productId={productId}
          currentPrice={currentPrice}
          loading={Boolean(user) && alert.loading}
          alert={myAlert}
          onChange={setEdited}
        />
      </div>
    </section>
  )
}

function Stat({ label, value, className = '' }) {
  return (
    <div className="rounded-lg bg-slate-50 p-2">
      <dt className="text-[11px] text-slate-500">{label}</dt>
      {/* nowrap + chữ nhỏ hơn ở 360px: "4.770.000 ₫" không bị rớt "₫" xuống dòng (BUG04) */}
      <dd className={`whitespace-nowrap text-[13px] font-semibold sm:text-base ${className}`}>
        {value}
      </dd>
    </div>
  )
}

// Khung "Báo tôi khi giá giảm": nhập giá mong muốn, lưu vào price_alerts.
function PriceAlertBox({ productId, currentPrice, loading, alert, onChange }) {
  const { user } = useAuth()
  const location = useLocation()
  const [text, setText] = useState('')
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const box = 'space-y-3 rounded-xl border border-slate-200 bg-white p-4 text-sm'
  const title = <h3 className="font-semibold">🔔 Báo tôi khi giá giảm</h3>

  if (!user) {
    return (
      <div className={box}>
        {title}
        <p className="text-slate-600">
          Đặt giá mong muốn, web sẽ báo khi giá xuống bằng hoặc thấp hơn mức đó.
        </p>
        <Link
          to={`/dang-nhap?next=${encodeURIComponent(location.pathname)}`}
          className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-blue-600 font-medium text-blue-700 hover:bg-blue-50"
        >
          Đăng nhập để đặt cảnh báo
        </Link>
      </div>
    )
  }
  if (loading) return <div className={`${box} h-40 animate-pulse`} />

  const notify = () => window.dispatchEvent(new Event(ALERTS_CHANGED))

  const save = async (e) => {
    e.preventDefault()
    const target = parsePriceInput(text)
    const msg = validateTargetPrice(target, currentPrice)
    if (msg) return setError(msg)
    setBusy(true)
    setError('')
    try {
      onChange(await upsertPriceAlert(user.id, productId, target))
      setEditing(false)
      notify()
    } catch (err) {
      setError(`Không lưu được: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    setError('')
    try {
      await deletePriceAlert(alert.id)
      onChange(null)
      notify()
    } catch (err) {
      setError(`Không xóa được: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  if (alert && !editing) {
    const reached = currentPrice != null && currentPrice <= alert.target_price
    return (
      <div className={box}>
        {title}
        <p>
          Giá mong muốn:{' '}
          <strong className="text-green-700">{formatPrice(alert.target_price)}</strong>
        </p>
        <p className={reached ? 'font-medium text-green-700' : 'text-slate-500'}>
          {reached
            ? '✓ Giá hiện tại đã đạt mức bạn mong muốn!'
            : `Còn cách ${formatPrice(currentPrice - alert.target_price)}. Web sẽ báo khi bạn mở trang lúc giá giảm.`}
        </p>
        {error && <p className="text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setText(alert.target_price.toLocaleString('vi-VN'))
              setEditing(true)
            }}
            className="h-11 flex-1 rounded-lg border border-slate-300 font-medium hover:bg-slate-50"
          >
            Đổi giá
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="h-11 rounded-lg px-3 text-slate-500 hover:bg-slate-100 hover:text-red-600 disabled:opacity-60"
          >
            Hủy cảnh báo
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={save} className={box} noValidate>
      {title}
      <p className="text-slate-600">
        Giá hiện tại {formatPrice(currentPrice)}. Nhập mức giá bạn muốn mua:
      </p>
      <label className="block">
        <span className="sr-only">Giá mong muốn</span>
        <div className="relative">
          <input
            inputMode="numeric"
            placeholder={
              currentPrice
                ? (Math.round((currentPrice * 0.9) / 10000) * 10000).toLocaleString('vi-VN')
                : ''
            }
            value={text}
            onChange={(e) => {
              // Tự thêm dấu chấm hàng nghìn khi gõ: 5000000 → 5.000.000
              const n = parsePriceInput(e.target.value)
              setText(n ? n.toLocaleString('vi-VN') : '')
              setError('')
            }}
            aria-invalid={Boolean(error)}
            className="h-11 w-full rounded-lg border border-slate-300 pl-3 pr-8 focus:border-blue-500 focus:outline-none"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
            ₫
          </span>
        </div>
      </label>
      {error && <p className="text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="h-11 flex-1 rounded-lg bg-blue-600 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {busy ? 'Đang lưu…' : 'Đặt cảnh báo'}
        </button>
        {editing && (
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="h-11 rounded-lg px-3 text-slate-500 hover:bg-slate-100"
          >
            Hủy
          </button>
        )}
      </div>
    </form>
  )
}
