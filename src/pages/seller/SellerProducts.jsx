import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAsync } from '../../hooks/useAsync'
import { getSellerProducts, setSellerProductStatus } from '../../lib/api'
import { formatPrice } from '../../lib/format'
import { categoryImage, thumbUrl } from '../../lib/images'
import { PRODUCT_STATUS, sellerActions } from '../../features/seller/sellerProduct'

const ACTIONS = {
  hide: { label: 'Ẩn', status: 'hidden', done: 'Đã ẩn' },
  show: { label: 'Hiện lại', status: 'active', done: 'Đã hiện lại' },
  resubmit: { label: 'Gửi duyệt lại', status: 'pending', done: 'Đã gửi duyệt lại' },
}

const FILTERS = [
  { value: '', label: 'Tất cả' },
  { value: 'pending', label: 'Chờ duyệt' },
  { value: 'active', label: 'Đang bán' },
  { value: 'hidden', label: 'Đã ẩn' },
]

// Danh sách sản phẩm của shop trong kênh người bán (US-14.4, US-14.6).
// Người bán không xóa sản phẩm (có thể nằm trong đơn), chỉ ẩn.
export default function SellerProducts({ shop, canEdit }) {
  const location = useLocation()
  const [reload, setReload] = useState(0)
  const products = useAsync(() => getSellerProducts(shop.id), [shop.id, reload])
  const [filter, setFilter] = useState('')
  const [busy, setBusy] = useState(null)
  const [message, setMessage] = useState(
    location.state?.notice ? { type: 'success', text: location.state.notice } : null,
  )

  const act = async (product, action) => {
    setBusy(product.id)
    try {
      await setSellerProductStatus(product.id, ACTIONS[action].status)
      setMessage({ type: 'success', text: `${ACTIONS[action].done} “${product.name}”.` })
      setReload((n) => n + 1)
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setBusy(null)
    }
  }

  const all = products.data ?? []
  const count = (status) => all.filter((p) => !status || p.status === status).length
  const list = all.filter((p) => !filter || p.status === filter)

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Sản phẩm của shop</h2>
        {canEdit && (
          <Link
            to="/kenh-nguoi-ban/san-pham/moi"
            className="inline-flex h-11 items-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
          >
            + Đăng sản phẩm
          </Link>
        )}
      </div>

      <div
        role="tablist"
        aria-label="Lọc theo trạng thái"
        className="flex gap-1 overflow-x-auto rounded-xl bg-surface p-1 ring-1 ring-slate-200"
      >
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            role="tab"
            aria-selected={filter === f.value}
            onClick={() => setFilter(f.value)}
            className={`inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 text-sm font-medium ${
              filter === f.value
                ? 'bg-gray-900 text-white dark:bg-blue-600'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {f.label} ({count(f.value)})
          </button>
        ))}
      </div>

      {message && (
        <p
          role={message.type === 'error' ? 'alert' : 'status'}
          className={`rounded-lg p-3 text-sm ${message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-800'}`}
        >
          {message.text}
        </p>
      )}
      {products.loading && <p className="py-8 text-center text-slate-500">Đang tải sản phẩm…</p>}
      {products.error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          Không tải được sản phẩm: {products.error.message}
        </p>
      )}
      {products.data && !list.length && (
        <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          {all.length ? 'Không có sản phẩm ở trạng thái này.' : 'Shop chưa có sản phẩm nào.'}
        </p>
      )}

      {list.length > 0 && (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-surface">
          {list.map((p) => {
            const status = PRODUCT_STATUS[p.status]
            return (
              <li key={p.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <img
                    src={thumbUrl(p.image_url) || categoryImage(p.categories?.slug)}
                    alt=""
                    loading="lazy"
                    className="h-14 w-14 shrink-0 rounded-md border border-slate-100 bg-white object-contain"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-slate-500">
                      #{p.id} · {p.categories?.name} · {p.brand ?? '—'}
                    </p>
                    <p className="text-sm">
                      <span className="font-semibold text-red-600 dark:text-red-400">
                        {formatPrice(p.price)}
                      </span>
                      <span className="ml-2 text-xs text-slate-500">Kho: {p.stock}</span>
                      <span
                        className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${status?.className}`}
                      >
                        {status?.label}
                      </span>
                    </p>
                    {p.review_note && (
                      <p className="mt-1 rounded-md bg-red-50 px-2 py-1 text-xs text-red-700">
                        Admin trả lại: <span className="whitespace-pre-line">{p.review_note}</span>
                      </p>
                    )}
                    {p.status === 'hidden' && !p.approved_at && !p.review_note && (
                      <p className="mt-1 text-xs text-slate-500">
                        Admin đã gỡ sản phẩm; sửa rồi gửi duyệt lại để bán tiếp.
                      </p>
                    )}
                  </div>
                </div>
                {canEdit && (
                  <div className="flex shrink-0 gap-1 sm:flex-col lg:flex-row">
                    <Link
                      to={`/kenh-nguoi-ban/san-pham/${p.id}`}
                      className="inline-flex h-10 flex-1 items-center justify-center rounded-lg border border-slate-300 px-3 text-sm font-medium hover:bg-slate-50"
                    >
                      Sửa
                    </Link>
                    {sellerActions(p).map((action) => (
                      <button
                        key={action}
                        type="button"
                        disabled={busy === p.id}
                        onClick={() => act(p, action)}
                        className="inline-flex h-10 flex-1 items-center justify-center whitespace-nowrap rounded-lg px-3 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-60"
                      >
                        {ACTIONS[action].label}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
