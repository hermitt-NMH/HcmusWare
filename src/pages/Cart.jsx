import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCart } from '../hooks/useCart'
import { getProductsByIds } from '../lib/api'
import { formatPrice } from '../lib/format'
import { categoryImage, thumbUrl } from '../lib/images'
import { isUnavailable, maxQty } from '../features/cart/cart'

// Trang giỏ hàng: đổi số lượng, xóa, tạm tính, sang trang thanh toán.
export default function Cart() {
  const { items, count, subtotal, setQty, removeItem, clear, refresh } = useCart()
  const [syncError, setSyncError] = useState(null)

  // Mở trang thì lấy giá/tồn kho mới nhất một lần (giỏ lưu bản chụp lúc thêm, có thể đã cũ).
  // Chỉ chạy theo danh sách id để đổi số lượng không gọi lại DB.
  const idsKey = items.map((it) => it.id).join(',')
  useEffect(() => {
    if (!idsKey) return
    let cancelled = false
    getProductsByIds(idsKey.split(',').map(Number))
      .then((products) => {
        if (cancelled) return
        setSyncError(null)
        refresh(products)
      })
      .catch((err) => !cancelled && setSyncError(err))
    return () => {
      cancelled = true
    }
  }, [idsKey, refresh])

  if (!items.length) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-xl font-bold">Giỏ hàng trống</h1>
        <p className="mt-2 text-slate-500">Chọn linh kiện lẻ hoặc tự build cả bộ máy.</p>
        <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
          <Link
            to="/build-pc"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-blue-600 px-5 font-semibold text-white hover:bg-blue-700"
          >
            Build PC
          </Link>
          <Link
            to="/san-pham"
            className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-300 bg-surface px-5 font-medium text-slate-700 hover:bg-slate-50"
          >
            Xem sản phẩm
          </Link>
        </div>
      </div>
    )
  }

  const hasUnavailable = items.some(isUnavailable)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Giỏ hàng ({count})</h1>
        <button
          type="button"
          onClick={() => window.confirm('Xóa toàn bộ giỏ hàng?') && clear()}
          className="inline-flex min-h-11 items-center px-2 text-sm text-slate-500 hover:text-red-600 dark:hover:text-red-400"
        >
          Xóa tất cả
        </button>
      </div>

      {syncError && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          Chưa cập nhật được giá mới nhất ({syncError.message}). Giá hiển thị là giá lúc thêm vào
          giỏ.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px] lg:items-start">
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-surface">
          {items.map((it) => (
            <CartLine key={it.id} item={it} onQty={setQty} onRemove={removeItem} />
          ))}
        </ul>

        <aside className="space-y-3 rounded-xl border border-slate-200 bg-surface p-4 lg:sticky lg:top-36">
          <div className="flex items-center justify-between">
            <span className="text-slate-600">Tạm tính</span>
            <span className="text-xl font-bold text-red-600 dark:text-red-400">
              {formatPrice(subtotal)}
            </span>
          </div>
          <p className="text-xs text-slate-500">Miễn phí giao hàng toàn quốc.</p>
          {hasUnavailable && (
            <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-800">
              Có sản phẩm hết hàng hoặc ngừng bán, không tính vào tạm tính. Hãy xóa khỏi giỏ.
            </p>
          )}
          {/* Chưa đăng nhập thì trang thanh toán tự chuyển sang đăng nhập rồi quay lại */}
          {subtotal > 0 ? (
            <Link
              to="/thanh-toan"
              className="flex h-12 w-full items-center justify-center rounded-lg bg-blue-600 font-semibold text-white hover:bg-blue-700"
            >
              Thanh toán
            </Link>
          ) : (
            <button
              type="button"
              disabled
              className="h-12 w-full rounded-lg bg-blue-600 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Thanh toán
            </button>
          )}
          <Link
            to="/san-pham"
            className="flex min-h-11 items-center justify-center text-sm text-blue-700 dark:text-blue-300 hover:underline"
          >
            Tiếp tục mua sắm
          </Link>
        </aside>
      </div>
    </div>
  )
}

function CartLine({ item, onQty, onRemove }) {
  const { id, name, brand, price, image_url, slug, stock, qty, missing } = item
  const fallback = categoryImage(slug)
  const unavailable = isUnavailable(item)
  const max = maxQty(item)

  return (
    <li className="flex gap-3 p-3 sm:p-4">
      <Link to={`/san-pham/${id}`} className="shrink-0">
        <img
          src={thumbUrl(image_url) || fallback}
          alt={name}
          onError={(e) => {
            if (!e.currentTarget.src.endsWith(fallback)) e.currentTarget.src = fallback
          }}
          className={`h-20 w-20 rounded-lg border border-slate-100 object-contain p-1 ${unavailable ? 'opacity-50 grayscale' : ''}`}
        />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div>
          {brand && <p className="text-xs font-semibold uppercase text-slate-500">{brand}</p>}
          <Link
            to={`/san-pham/${id}`}
            className="line-clamp-2 text-sm font-medium text-slate-900 hover:text-blue-700 dark:hover:text-blue-300"
          >
            {name}
          </Link>
          {missing ? (
            <p className="text-xs font-medium text-red-600 dark:text-red-400">
              Sản phẩm đã ngừng bán
            </p>
          ) : stock <= 0 ? (
            <p className="text-xs font-medium text-red-600 dark:text-red-400">Hết hàng</p>
          ) : (
            stock < qty + 3 && (
              <p className="text-xs text-amber-700 dark:text-amber-300">Chỉ còn {stock} sản phẩm</p>
            )
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <QtyStepper
            value={qty}
            max={max}
            disabled={unavailable}
            label={name}
            onChange={(v) => onQty(id, v)}
          />
          <p className="font-semibold text-red-600 dark:text-red-400">
            {price == null ? 'Liên hệ' : formatPrice(price * qty)}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onRemove(id)}
        aria-label={`Xóa ${name} khỏi giỏ`}
        className="-mr-1 -mt-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-red-600 dark:hover:text-red-400"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
        </svg>
      </button>
    </li>
  )
}

// Nút − số + ; vùng bấm 44px cho điện thoại.
function QtyStepper({ value, max, disabled, label, onChange }) {
  const btn =
    'inline-flex h-11 w-11 items-center justify-center text-lg text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300'
  return (
    <div className="inline-flex items-center overflow-hidden rounded-lg border border-slate-300">
      <button
        type="button"
        className={btn}
        disabled={disabled}
        onClick={() => onChange(value - 1)}
        aria-label={`Giảm số lượng ${label}`}
      >
        −
      </button>
      <span className="w-10 text-center text-sm font-medium" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className={btn}
        disabled={disabled || value >= max}
        onClick={() => onChange(value + 1)}
        aria-label={`Tăng số lượng ${label}`}
      >
        +
      </button>
    </div>
  )
}
