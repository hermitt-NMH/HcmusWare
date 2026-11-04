import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAsync } from '../../hooks/useAsync'
import {
  approveProduct,
  approveShop,
  createBrand,
  getAdminShops,
  getBrands,
  getPendingProducts,
  rejectProduct,
  rejectShop,
  setProductBrand,
  setShopLocked,
} from '../../lib/api'
import { formatDate, formatDateTime, formatPrice } from '../../lib/format'
import { SPEC_FIELDS, formatSpecValue } from '../../lib/specs'
import { validateSpecs, visibleSpecFields } from '../../features/seller/specFields'
import { SHOP_STATUS } from '../../features/seller/shopForm'
import LogoBadge from '../../components/LogoBadge'
import { t, tKey } from '../../lib/i18n'

const TABS = [
  { value: 'shop', label: tKey('Shop chờ duyệt') },
  { value: 'san-pham', label: tKey('Sản phẩm chờ duyệt') },
  { value: 'tat-ca-shop', label: tKey('Các shop') },
]

const btn = {
  primary:
    'inline-flex h-11 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60',
  outline:
    'inline-flex h-11 items-center justify-center rounded-lg border border-slate-300 px-4 text-sm font-medium hover:bg-slate-50 disabled:opacity-60',
  danger:
    'inline-flex h-11 items-center justify-center rounded-lg border border-red-300 px-4 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60',
}

// /admin/duyet (US-14.2, 14.3, 14.5): duyệt / từ chối shop, duyệt / trả lại sản phẩm, khóa shop.
// Mọi thao tác gọi hàm trong DB (approve_shop, reject_product...), hàm tự kiểm tra là admin.
export default function AdminReview() {
  const [params, setParams] = useSearchParams()
  const tab = TABS.some((tb) => tb.value === params.get('tab')) ? params.get('tab') : 'shop'
  const [reload, setReload] = useState(0)
  const [message, setMessage] = useState(null)
  const shops = useAsync(() => getAdminShops('pending'), [reload])
  const products = useAsync(getPendingProducts, [reload])

  // Chạy một thao tác, báo kết quả, tải lại danh sách. Lỗi từ DB (vd chưa có thương hiệu) hiện nguyên văn.
  const run = async (fn, success) => {
    try {
      await fn()
      setMessage({ type: 'success', text: success })
      setReload((n) => n + 1)
      return true
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
      return false
    }
  }

  const count = { shop: shops.data?.length, 'san-pham': products.data?.length }
  return (
    <div className="space-y-3">
      <div
        role="tablist"
        className="flex gap-1 overflow-x-auto rounded-xl bg-surface p-1 ring-1 ring-slate-200"
      >
        {TABS.map((tb) => (
          <button
            key={tb.value}
            type="button"
            role="tab"
            aria-selected={tab === tb.value}
            onClick={() => {
              setParams(tb.value === 'shop' ? {} : { tab: tb.value })
              setMessage(null)
            }}
            className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium ${
              tab === tb.value
                ? 'bg-gray-900 text-white dark:bg-blue-600'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t(tb.label)}
            {count[tb.value] > 0 && (
              <span className="rounded-full bg-amber-500 px-2 text-xs font-bold text-gray-900">
                {count[tb.value]}
              </span>
            )}
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

      {tab === 'shop' && <PendingShops shops={shops} run={run} />}
      {tab === 'san-pham' && <PendingProducts products={products} run={run} />}
      {tab === 'tat-ca-shop' && <AllShops reload={reload} run={run} />}
    </div>
  )
}

function AsyncState({ state, empty, children }) {
  if (state.loading) return <p className="py-8 text-center text-slate-500">{t('Đang tải…')}</p>
  if (state.error)
    return (
      <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
        {t('Không tải được: {msg}', { msg: t(state.error.message) })}
      </p>
    )
  if (!state.data.length)
    return (
      <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
        {empty}
      </p>
    )
  return children
}

// Ô nhập lý do (bắt buộc, ≤ 500 ký tự) cho Từ chối shop / Trả lại sản phẩm.
function ReasonForm({ label, onSubmit, onCancel }) {
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    if (!note.trim()) return setError(t('Nhập lý do.'))
    setBusy(true)
    const ok = await onSubmit(note.trim())
    if (!ok) setBusy(false)
  }
  return (
    <form onSubmit={submit} className="space-y-2 rounded-lg bg-slate-50 p-3">
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">{label}</span>
        <textarea
          autoFocus
          rows={2}
          maxLength={500}
          value={note}
          onChange={(e) => {
            setNote(e.target.value)
            setError('')
          }}
          aria-invalid={error ? 'true' : undefined}
          className="w-full rounded-lg border border-slate-300 bg-surface p-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        {error && <span className="block text-red-600 dark:text-red-400">{error}</span>}
      </label>
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className={btn.danger}>
          {t('Gửi')}
        </button>
        <button type="button" onClick={onCancel} className={btn.outline}>
          {t('Hủy')}
        </button>
      </div>
    </form>
  )
}

function PendingShops({ shops, run }) {
  const [rejecting, setRejecting] = useState(null)
  return (
    <AsyncState state={shops} empty={t('Không có shop nào chờ duyệt.')}>
      <ul className="space-y-3">
        {shops.data?.map((s) => (
          <li key={s.id} className="space-y-3 rounded-xl border border-slate-200 bg-surface p-4">
            <div className="flex gap-3">
              <LogoBadge name={s.name} url={s.logo_url} />
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold">{s.name}</h3>
                <p className="break-all text-xs text-slate-500">
                  {s.owner_email} · {t('đăng ký {time}', { time: formatDateTime(s.created_at) })} ·
                  /shop/{s.slug}
                </p>
                {s.description && (
                  <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{s.description}</p>
                )}
              </div>
            </div>
            {rejecting === s.id ? (
              <ReasonForm
                label={t('Lý do từ chối shop “{name}”', s)}
                onCancel={() => setRejecting(null)}
                onSubmit={(note) =>
                  run(() => rejectShop(s.id, note), t('Đã từ chối shop “{name}”.', s))
                }
              />
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={btn.primary}
                  onClick={() =>
                    run(
                      () => approveShop(s.id),
                      t('Đã duyệt shop “{name}”. Chủ shop đã có vai trò người bán.', s),
                    )
                  }
                >
                  {t('Duyệt')}
                </button>
                <button type="button" className={btn.danger} onClick={() => setRejecting(s.id)}>
                  {t('Từ chối')}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </AsyncState>
  )
}

function PendingProducts({ products, run }) {
  const brands = useAsync(getBrands, [products.data?.length])
  return (
    <AsyncState state={products} empty={t('Không có sản phẩm nào chờ duyệt.')}>
      <ul className="space-y-3">
        {products.data?.map((p) => (
          <PendingProduct key={p.id} product={p} brands={brands.data ?? []} run={run} />
        ))}
      </ul>
    </AsyncState>
  )
}

function PendingProduct({ product: p, brands, run }) {
  const [rejecting, setRejecting] = useState(false)
  const [brandId, setBrandId] = useState('')
  const slug = p.categories?.slug
  const images = p.images?.length ? p.images : p.image_url ? [p.image_url] : []
  // Tô vàng thông số ngoài khoảng thường gặp, đỏ nếu sai (vd sản phẩm cũ thiếu thông số bắt buộc).
  const check = validateSpecs(slug, p.specs ?? {})
  const labels = Object.fromEntries((SPEC_FIELDS[slug] ?? []).map((f) => [f.key, f]))
  const rows = visibleSpecFields(slug, p.specs ?? {})
  const extra = Object.keys(p.specs ?? {}).filter((k) => !rows.some((f) => f.key === k))
  const sameName = brands.find((b) => b.name.toLowerCase() === (p.brand ?? '').trim().toLowerCase())

  return (
    <li className="space-y-3 rounded-xl border border-slate-200 bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold">{p.name}</h3>
          <p className="text-xs text-slate-500">
            #{p.id} · {t(p.categories?.name)} · shop{' '}
            <span className="font-medium text-slate-700">{p.shops?.name}</span> ·{' '}
            {t('gửi {date}', { date: formatDate(p.created_at) })}
          </p>
        </div>
        <p className="text-right">
          <span className="font-semibold text-red-600 dark:text-red-400">
            {formatPrice(p.price)}
          </span>
          <span className="block text-xs text-slate-500">{t('Kho: {n}', { n: p.stock })}</span>
        </p>
      </div>

      {images.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {images.map((url, i) => (
            <a key={url} href={url} target="_blank" rel="noreferrer" className="shrink-0">
              <img
                src={url}
                alt={t('Ảnh {i} của {name}', { i: i + 1, name: p.name })}
                loading="lazy"
                className="h-24 w-24 rounded-lg border border-slate-200 bg-white object-contain"
              />
            </a>
          ))}
        </div>
      )}

      <table className="w-full text-sm">
        <tbody className="divide-y divide-slate-100">
          {rows.map((f) => {
            const warn = check.warnings[f.key]
            const err = check.errors[f.key]
            return (
              <tr
                key={f.key}
                className={err ? 'bg-red-50' : warn ? 'bg-amber-50' : undefined}
                title={err ?? warn}
              >
                <th className="w-1/2 py-1.5 pl-2 text-left font-normal text-slate-500">
                  {t(f.label)}
                </th>
                <td className="py-1.5 pr-2">
                  {formatSpecValue(labels[f.key] ?? f, p.specs?.[f.key])}
                  {(err || warn) && (
                    <span className={`block text-xs ${err ? 'text-red-700' : 'text-amber-800'}`}>
                      {err ?? warn}
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
          {extra.map((k) => (
            <tr key={k}>
              <th className="py-1.5 pl-2 text-left font-normal text-slate-500">{k}</th>
              <td className="py-1.5 pr-2">{formatSpecValue({ key: k }, p.specs[k])}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {p.description && (
        <p className="line-clamp-4 whitespace-pre-line text-sm text-slate-600">{p.description}</p>
      )}
      {p.datasheet_url && (
        <a
          href={p.datasheet_url}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex min-h-11 items-center text-sm text-blue-700 underline dark:text-blue-300"
        >
          Datasheet
        </a>
      )}

      {/* C1: "Thương hiệu khác" → admin chọn hoặc tạo thương hiệu rồi mới duyệt được */}
      <div className="text-sm">
        {t('Thương hiệu:')}{' '}
        {p.brand_id ? (
          <span className="font-medium">{p.brand}</span>
        ) : (
          <span className="font-medium text-amber-800">
            {t('“{brand}” (chưa có trong danh sách)', p)}
          </span>
        )}
      </div>
      {!p.brand_id && (
        <div className="flex flex-wrap gap-2 rounded-lg bg-amber-50 p-3">
          <select
            value={brandId || (sameName ? String(sameName.id) : '')}
            onChange={(e) => setBrandId(e.target.value)}
            aria-label={t('Chọn thương hiệu có sẵn')}
            className="h-11 min-w-0 flex-1 rounded-lg border border-slate-300 bg-surface px-2 text-sm"
          >
            <option value="">{t('— Chọn thương hiệu có sẵn —')}</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={btn.outline}
            disabled={!(brandId || sameName)}
            onClick={() =>
              run(
                () => setProductBrand(p.id, Number(brandId || sameName.id)),
                t('Đã gán thương hiệu cho “{name}”.', p),
              )
            }
          >
            {t('Gán')}
          </button>
          {!sameName && p.brand?.trim() && (
            <button
              type="button"
              className={btn.outline}
              onClick={() =>
                run(
                  async () => {
                    const brand = await createBrand(p.brand)
                    await setProductBrand(p.id, brand.id)
                  },
                  t('Đã tạo thương hiệu “{brand}” và gán cho sản phẩm.', { brand: p.brand.trim() }),
                )
              }
            >
              {t('Tạo thương hiệu “{brand}”', { brand: p.brand.trim() })}
            </button>
          )}
        </div>
      )}

      {rejecting ? (
        <ReasonForm
          label={t('Lý do trả lại “{name}”', p)}
          onCancel={() => setRejecting(false)}
          onSubmit={(note) => run(() => rejectProduct(p.id, note), t('Đã trả lại “{name}”.', p))}
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={btn.primary}
            disabled={!p.brand_id}
            title={p.brand_id ? undefined : t('Chọn hoặc tạo thương hiệu trước')}
            onClick={() =>
              run(() => approveProduct(p.id), t('Đã duyệt “{name}”: sản phẩm đã hiện trên web.', p))
            }
          >
            {t('Duyệt')}
          </button>
          <button type="button" className={btn.danger} onClick={() => setRejecting(true)}>
            {t('Trả lại')}
          </button>
        </div>
      )}
    </li>
  )
}

function AllShops({ reload, run }) {
  const shops = useAsync(() => getAdminShops(null), [reload])
  const toggleLock = (s) => {
    const lock = s.status === 'active'
    const question = lock
      ? t('Khóa shop “{name}”? Mọi sản phẩm của shop sẽ ẩn khỏi web ngay.', s)
      : t('Mở khóa shop “{name}”? Sản phẩm đã duyệt sẽ hiện lại.', s)
    if (!window.confirm(question)) return
    run(
      () => setShopLocked(s.id, lock),
      lock ? t('Đã khóa shop “{name}”.', s) : t('Đã mở khóa shop “{name}”.', s),
    )
  }
  return (
    <AsyncState state={shops} empty={t('Chưa có shop nào.')}>
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-surface">
        {shops.data?.map((s) => {
          const status = SHOP_STATUS[s.status]
          return (
            <li key={s.id} className="flex flex-wrap items-center gap-3 p-3">
              <LogoBadge name={s.name} url={s.logo_url} size="h-12 w-12" />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {s.status === 'active' ? (
                    <Link
                      to={`/shop/${s.slug}`}
                      className="hover:text-blue-700 hover:underline dark:hover:text-blue-300"
                    >
                      {s.name}
                    </Link>
                  ) : (
                    s.name
                  )}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${status?.className}`}
                  >
                    {t(status?.label)}
                  </span>
                </p>
                <p className="break-all text-xs text-slate-500">
                  {s.owner_email ?? t('Chưa có chủ')} · {t('{n} sản phẩm', { n: s.product_count })}
                  {s.pending_products > 0 && ` (${t('{n} chờ duyệt', { n: s.pending_products })})`}
                </p>
              </div>
              {s.slug !== 'hcmusware' && (s.status === 'active' || s.status === 'locked') && (
                <button
                  type="button"
                  onClick={() => toggleLock(s)}
                  className={s.status === 'active' ? btn.danger : btn.outline}
                >
                  {s.status === 'active' ? t('Khóa shop') : t('Mở khóa')}
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </AsyncState>
  )
}
