import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useCart } from '../hooks/useCart'
import { useAsync } from '../hooks/useAsync'
import { getMyAddresses, getProductsByIds, placeOrder, saveAddress } from '../lib/api'
import { formatPrice } from '../lib/format'
import { categoryImage, thumbUrl } from '../lib/images'
import { cartShops, isUnavailable } from '../features/cart/cart'
import {
  PAYMENT_METHODS,
  cartToOrderItems,
  orderErrorMessage,
  validateCheckout,
} from '../features/orders/orders'
import AddressFields from '../features/address/AddressFields'
import {
  MAX_ADDRESSES,
  addressToForm,
  defaultAddress,
  formatAddress,
  validateAddress,
} from '../features/address/address'

const inputClass =
  'h-11 w-full rounded-lg border bg-surface px-3 text-sm focus:border-blue-500 focus:outline-none'

// Trang thanh toán: thông tin giao hàng, chọn COD / online mô phỏng, đặt hàng.
// Giá và tổng tiền thật do hàm place_order trong DB tính (không tin số ở trình duyệt).
export default function Checkout() {
  const { user, loading } = useAuth()
  const { items } = useCart()
  const location = useLocation()
  // Đã đặt xong: giỏ vừa được xóa nhưng trang đơn hàng chưa kịp hiện (React Router v7 chuyển
  // trang ở chế độ "transition", chạy SAU lần cập nhật giỏ) → không được chuyển về /gio-hang.
  const [placed, setPlaced] = useState(false)

  if (loading) return <p className="py-16 text-center text-slate-500">Đang kiểm tra đăng nhập…</p>
  if (!user)
    return <Navigate to={`/dang-nhap?next=${encodeURIComponent(location.pathname)}`} replace />
  if (placed) return <p className="py-16 text-center text-slate-500">Đang mở đơn hàng…</p>
  if (!items.length) return <Navigate to="/gio-hang" replace />

  return <CheckoutForm onPlaced={() => setPlaced(true)} />
}

function CheckoutForm({ onPlaced }) {
  const { profile } = useAuth()
  const { items, subtotal, removeItem, refresh } = useCart()
  const navigate = useNavigate()
  const [form, setForm] = useState({ note: '', payment: 'cod' })

  // Địa chỉ giao hàng (US-17.3): có sổ địa chỉ → điền sẵn địa chỉ mặc định, "Đổi địa chỉ" để chọn
  // địa chỉ khác; sổ trống → nhập địa chỉ mới (có gợi ý), mặc định lưu vào sổ.
  const book = useAsync(getMyAddresses, [])
  const [addressId, setAddressId] = useState(null) // null = nhập địa chỉ mới
  const [picking, setPicking] = useState(false)
  const [newAddress, setNewAddress] = useState(() => ({
    ...addressToForm(null),
    recipient_name: profile?.full_name ?? '',
    phone: profile?.phone ?? '',
  }))
  const [saveToBook, setSaveToBook] = useState(true)
  const [addressErrors, setAddressErrors] = useState({})

  // Sổ địa chỉ tải xong → chọn sẵn địa chỉ mặc định (một lần).
  // Cập nhật state ngay khi render (không dùng useEffect) theo hướng dẫn của React.
  const [bookReady, setBookReady] = useState(false)
  if (!bookReady && (book.data || book.error)) {
    setBookReady(true)
    const preferred = defaultAddress(book.data)
    setAddressId(preferred?.id ?? null)
    setSaveToBook(!book.data?.length)
  }
  const addresses = book.data ?? []
  const selected = addresses.find((a) => a.id === addressId) ?? null
  const bookFull = addresses.length >= MAX_ADDRESSES

  // Hồ sơ thường tải xong SAU khi form đã hiện (AuthContext tải hồ sơ sau phiên đăng nhập).
  // Lúc đó chỉ điền vào ô còn trống, giữ nguyên những gì khách đã gõ (BUG07).
  const [filledFrom, setFilledFrom] = useState(profile?.id ?? null)
  if (profile && filledFrom !== profile.id) {
    setFilledFrom(profile.id)
    setNewAddress((f) => ({
      ...f,
      recipient_name: f.recipient_name || profile.full_name || '',
      phone: f.phone || profile.phone || '',
    }))
  }
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Lấy giá/tồn kho mới nhất trước khi khách bấm đặt hàng.
  const idsKey = items.map((it) => it.id).join(',')
  useEffect(() => {
    if (!idsKey) return
    let cancelled = false
    getProductsByIds(idsKey.split(',').map(Number))
      .then((products) => !cancelled && refresh(products))
      .catch(() => {}) // lỗi mạng: vẫn hiện giá trong giỏ, DB sẽ tính lại khi đặt
    return () => {
      cancelled = true
    }
  }, [idsKey, refresh])

  const buyable = items.filter((it) => !isUnavailable(it) && it.price != null)
  const skipped = items.length - buyable.length
  const shops = cartShops(items)

  const set = (key) => (e) => {
    setForm({ ...form, [key]: e.target.value })
    setErrors({ ...errors, [key]: undefined })
  }

  const changeNewAddress = (patch) => {
    setNewAddress((f) => ({ ...f, ...patch }))
    setAddressErrors((e) => ({
      ...e,
      ...Object.fromEntries(Object.keys(patch).map((k) => [k, undefined])),
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return
    setSubmitError('')

    // Địa chỉ trong sổ đã hợp lệ (DB kiểm tra lúc lưu); địa chỉ mới thì kiểm tra như sổ địa chỉ.
    let shippingFrom = selected
    let toSave = null
    if (!selected) {
      const { data: addr, errors: found } = validateAddress(newAddress)
      setAddressErrors(found)
      if (Object.keys(found).length) return
      shippingFrom = addr
      if (saveToBook && !bookFull) toSave = addr
    }
    // Đơn lưu bản sao địa chỉ dạng chữ → sửa sổ địa chỉ sau này không đổi đơn cũ (US-17.3).
    const { data, errors: found } = validateCheckout({
      ...form,
      name: shippingFrom.recipient_name,
      phone: shippingFrom.phone,
      address: formatAddress(shippingFrom),
    })
    setErrors(found)
    if (Object.keys(found).length) {
      // name/phone/address đã kiểm tra ở trên; còn lại (nếu có) báo chung.
      const other = ['name', 'phone', 'address'].map((k) => found[k]).find(Boolean)
      if (other) setSubmitError(other)
      return
    }
    const orderItems = cartToOrderItems(items)
    if (!orderItems.length) return setSubmitError('Không có sản phẩm nào còn hàng để đặt.')

    setSubmitting(true)
    try {
      const orderId = await placeOrder({ ...data, items: orderItems })
      onPlaced()
      navigate(
        data.payment === 'mock_online'
          ? `/thanh-toan/mo-phong/${orderId}`
          : `/don-hang/${orderId}?moi=1`,
        { replace: true },
      )
      // Chỉ bỏ khỏi giỏ những món đã đặt; món hết hàng vẫn để khách tự xử lý.
      orderItems.forEach((it) => removeItem(it.product_id))
      // Lưu vào sổ địa chỉ chạy nền, lỗi cũng không ảnh hưởng đơn đã đặt.
      if (toSave) saveAddress(null, toSave).catch(() => {})
    } catch (err) {
      setSubmitError(orderErrorMessage(err))
      setSubmitting(false)
      // Có thể do tồn kho vừa đổi → cập nhật lại giỏ.
      getProductsByIds(items.map((it) => it.id))
        .then(refresh)
        .catch(() => {})
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold sm:text-2xl">Thanh toán</h1>
        <Link
          to="/gio-hang"
          className="inline-flex min-h-11 items-center text-sm text-blue-700 dark:text-blue-300 hover:underline"
        >
          ← Sửa giỏ hàng
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px] lg:items-start">
        <div className="space-y-4">
          <section className="space-y-4 rounded-xl border border-slate-200 bg-surface p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Thông tin giao hàng</h2>
              {addresses.length > 0 && (
                <Link
                  to="/tai-khoan/dia-chi"
                  className="inline-flex min-h-11 items-center text-sm text-blue-700 hover:underline dark:text-blue-300"
                >
                  Quản lý sổ địa chỉ
                </Link>
              )}
            </div>

            {!bookReady ? (
              <p className="text-sm text-slate-500">Đang tải sổ địa chỉ…</p>
            ) : picking ? (
              <AddressPicker
                addresses={addresses}
                selectedId={addressId}
                onPick={(id) => {
                  setAddressId(id)
                  setPicking(false)
                }}
              />
            ) : selected ? (
              <div className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-blue-300 bg-blue-50 p-3 text-sm">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">
                    {selected.recipient_name} · {selected.phone}
                  </p>
                  <p className="text-slate-700">{formatAddress(selected)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPicking(true)}
                  className="inline-flex h-10 items-center rounded-lg px-3 font-medium text-blue-700 hover:bg-surface dark:text-blue-300"
                >
                  Đổi địa chỉ
                </button>
              </div>
            ) : (
              <>
                {addresses.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setPicking(true)}
                    className="inline-flex min-h-11 items-center text-sm text-blue-700 hover:underline dark:text-blue-300"
                  >
                    ← Chọn địa chỉ trong sổ
                  </button>
                )}
                <AddressFields
                  form={newAddress}
                  errors={addressErrors}
                  onChange={changeNewAddress}
                  idPrefix="thanh-toan"
                />
                <label className="flex min-h-11 items-center gap-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={saveToBook && !bookFull}
                    disabled={bookFull}
                    onChange={(e) => setSaveToBook(e.target.checked)}
                    className="h-5 w-5 accent-blue-600"
                  />
                  {bookFull
                    ? `Sổ địa chỉ đã đủ ${MAX_ADDRESSES} địa chỉ, không lưu thêm được`
                    : 'Lưu vào sổ địa chỉ'}
                </label>
              </>
            )}

            <Field label="Ghi chú (không bắt buộc)" error={errors.note}>
              <input
                className={`${inputClass} border-slate-300`}
                placeholder="Vd: giao giờ hành chính"
                maxLength={500}
                value={form.note}
                onChange={set('note')}
              />
            </Field>
          </section>

          <fieldset className="space-y-2 rounded-xl border border-slate-200 bg-surface p-4 sm:p-5">
            <legend className="px-1 text-lg font-semibold">Phương thức thanh toán</legend>
            {Object.entries(PAYMENT_METHODS).map(([value, m]) => (
              <label
                key={value}
                className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm ${
                  form.payment === value ? 'border-blue-500 bg-blue-50' : 'border-slate-200'
                }`}
              >
                <input
                  type="radio"
                  name="payment"
                  value={value}
                  checked={form.payment === value}
                  onChange={set('payment')}
                  className="mt-0.5 h-5 w-5 accent-blue-600"
                />
                <span>
                  <span className="block font-medium">{m.label}</span>
                  <span className="block text-xs text-slate-500">
                    {value === 'cod'
                      ? 'Trả tiền mặt cho nhân viên giao hàng.'
                      : 'Chuyển sang cổng thanh toán thử nghiệm, không trừ tiền thật.'}
                  </span>
                </span>
              </label>
            ))}
            {errors.payment && (
              <p className="text-sm text-red-600 dark:text-red-400">{errors.payment}</p>
            )}
          </fieldset>
        </div>

        <aside className="space-y-3 rounded-xl border border-slate-200 bg-surface p-4 lg:sticky lg:top-36">
          <h2 className="font-semibold">Đơn hàng ({buyable.length} sản phẩm)</h2>
          <ul className="max-h-72 space-y-3 overflow-y-auto">
            {buyable.map((it) => (
              <li key={it.id} className="flex gap-3 text-sm">
                <img
                  src={thumbUrl(it.image_url) || categoryImage(it.slug)}
                  alt=""
                  loading="lazy"
                  className="h-12 w-12 shrink-0 rounded-md border border-slate-100 object-contain"
                />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2">{it.name}</span>
                  <span className="text-xs text-slate-500">× {it.qty}</span>
                </span>
                <span className="shrink-0 font-medium">{formatPrice(it.price * it.qty)}</span>
              </li>
            ))}
          </ul>
          {shops.length > 1 && (
            <p className="rounded-md bg-blue-50 p-2 text-xs text-blue-800">
              Giỏ có hàng của {shops.length} shop ({shops.join(', ')}): mỗi shop là một đơn riêng,
              giao riêng, nhưng bạn chỉ thanh toán một lần.
            </p>
          )}
          {skipped > 0 && (
            <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-800">
              {skipped} sản phẩm hết hàng / ngừng bán không được đặt và vẫn nằm trong giỏ.
            </p>
          )}
          <dl className="space-y-1 border-t border-slate-100 pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-600">Tạm tính</dt>
              <dd>{formatPrice(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-600">Phí giao hàng</dt>
              <dd className="text-green-700 dark:text-green-400">Miễn phí</dd>
            </div>
            <div className="flex items-baseline justify-between pt-1">
              <dt className="font-medium">Tổng cộng</dt>
              <dd className="text-xl font-bold text-red-600 dark:text-red-400">
                {formatPrice(subtotal)}
              </dd>
            </div>
          </dl>

          {submitError && (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {submitError}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting || !buyable.length}
            className="h-12 w-full rounded-lg bg-blue-600 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting
              ? 'Đang đặt hàng…'
              : form.payment === 'mock_online'
                ? 'Đặt hàng và thanh toán'
                : 'Đặt hàng'}
          </button>
          <p className="text-center text-xs text-slate-500">
            Giá cuối cùng được xác nhận khi đặt hàng.
          </p>
        </aside>
      </div>
    </form>
  )
}

function Field({ label, error, children }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      {children}
      {error && <span className="mt-1 block text-sm text-red-600 dark:text-red-400">{error}</span>}
    </label>
  )
}

// Chọn một địa chỉ trong sổ, hoặc "Giao đến địa chỉ khác" (onPick(null) → nhập địa chỉ mới).
function AddressPicker({ addresses, selectedId, onPick }) {
  return (
    <div role="radiogroup" aria-label="Chọn địa chỉ giao hàng" className="space-y-2">
      {addresses.map((a) => (
        <button
          key={a.id}
          type="button"
          role="radio"
          aria-checked={a.id === selectedId}
          onClick={() => onPick(a.id)}
          className={`block w-full rounded-lg border p-3 text-left text-sm hover:bg-slate-50 ${
            a.id === selectedId ? 'border-blue-500 bg-blue-50' : 'border-slate-200'
          }`}
        >
          <span className="flex flex-wrap items-center gap-2 font-semibold">
            {a.recipient_name} · {a.phone}
            {a.is_default && (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-800">
                Mặc định
              </span>
            )}
          </span>
          <span className="block text-slate-600">{formatAddress(a)}</span>
        </button>
      ))}
      <button
        type="button"
        role="radio"
        aria-checked={selectedId === null}
        onClick={() => onPick(null)}
        className="flex min-h-11 w-full items-center rounded-lg border border-dashed border-slate-300 px-3 text-sm font-medium text-blue-700 hover:bg-slate-50 dark:text-blue-300"
      >
        + Giao đến địa chỉ khác
      </button>
    </div>
  )
}
