import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useCart } from '../hooks/useCart'
import { getProductsByIds, placeOrder } from '../lib/api'
import { formatPrice } from '../lib/format'
import { categoryImage } from '../lib/images'
import { isUnavailable } from '../features/cart/cart'
import {
  PAYMENT_METHODS,
  cartToOrderItems,
  orderErrorMessage,
  validateCheckout,
} from '../features/orders/orders'

const inputClass =
  'h-11 w-full rounded-lg border bg-white px-3 text-sm focus:border-blue-500 focus:outline-none'

// Trang thanh toán: thông tin giao hàng, chọn COD / online mô phỏng, đặt hàng.
// Giá và tổng tiền thật do hàm place_order trong DB tính (không tin số ở trình duyệt).
export default function Checkout() {
  const { user, profile, loading } = useAuth()
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

  // key: hồ sơ tải xong thì form điền sẵn lại theo hồ sơ.
  return <CheckoutForm key={profile?.id ?? 'loading'} onPlaced={() => setPlaced(true)} />
}

function CheckoutForm({ onPlaced }) {
  const { profile, updateProfile } = useAuth()
  const { items, subtotal, removeItem, refresh } = useCart()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: profile?.full_name ?? '',
    phone: profile?.phone ?? '',
    address: profile?.address ?? '',
    note: '',
    payment: 'cod',
  })
  // Hồ sơ chưa có địa chỉ thì mặc định lưu lại cho lần sau.
  const [saveInfo, setSaveInfo] = useState(!profile?.phone || !profile?.address)
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

  const set = (key) => (e) => {
    setForm({ ...form, [key]: e.target.value })
    setErrors({ ...errors, [key]: undefined })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return
    const { data, errors: found } = validateCheckout(form)
    setErrors(found)
    setSubmitError('')
    if (Object.keys(found).length) return
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
      // Lưu hồ sơ chạy nền, lỗi cũng không ảnh hưởng đơn đã đặt.
      if (saveInfo)
        updateProfile({ full_name: data.name, phone: data.phone, address: data.address })
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
          className="inline-flex min-h-11 items-center text-sm text-blue-700 hover:underline"
        >
          ← Sửa giỏ hàng
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px] lg:items-start">
        <div className="space-y-4">
          <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
            <h2 className="text-lg font-semibold">Thông tin giao hàng</h2>
            <Field label="Họ tên người nhận" error={errors.name}>
              <input
                className={`${inputClass} ${errors.name ? 'border-red-400' : 'border-slate-300'}`}
                autoComplete="name"
                value={form.name}
                onChange={set('name')}
                aria-invalid={Boolean(errors.name)}
              />
            </Field>
            <Field label="Số điện thoại" error={errors.phone}>
              <input
                className={`${inputClass} ${errors.phone ? 'border-red-400' : 'border-slate-300'}`}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="0901234567"
                value={form.phone}
                onChange={set('phone')}
                aria-invalid={Boolean(errors.phone)}
              />
            </Field>
            <Field label="Địa chỉ giao hàng" error={errors.address}>
              <textarea
                rows={3}
                autoComplete="street-address"
                placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành"
                value={form.address}
                onChange={set('address')}
                aria-invalid={Boolean(errors.address)}
                className={`w-full rounded-lg border bg-white p-3 text-sm focus:border-blue-500 focus:outline-none ${errors.address ? 'border-red-400' : 'border-slate-300'}`}
              />
            </Field>
            <Field label="Ghi chú (không bắt buộc)" error={errors.note}>
              <input
                className={`${inputClass} border-slate-300`}
                placeholder="Vd: giao giờ hành chính"
                maxLength={500}
                value={form.note}
                onChange={set('note')}
              />
            </Field>
            <label className="flex min-h-11 items-center gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={saveInfo}
                onChange={(e) => setSaveInfo(e.target.checked)}
                className="h-5 w-5 accent-blue-600"
              />
              Lưu thông tin này vào tài khoản cho lần sau
            </label>
          </section>

          <fieldset className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
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
            {errors.payment && <p className="text-sm text-red-600">{errors.payment}</p>}
          </fieldset>
        </div>

        <aside className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 lg:sticky lg:top-36">
          <h2 className="font-semibold">Đơn hàng ({buyable.length} sản phẩm)</h2>
          <ul className="max-h-72 space-y-3 overflow-y-auto">
            {buyable.map((it) => (
              <li key={it.id} className="flex gap-3 text-sm">
                <img
                  src={it.image_url || categoryImage(it.slug)}
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
              <dd className="text-green-700">Miễn phí</dd>
            </div>
            <div className="flex items-baseline justify-between pt-1">
              <dt className="font-medium">Tổng cộng</dt>
              <dd className="text-xl font-bold text-red-600">{formatPrice(subtotal)}</dd>
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
      {error && <span className="mt-1 block text-sm text-red-600">{error}</span>}
    </label>
  )
}
