import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useAsync } from '../hooks/useAsync'
import { createShop, getMyShop, updateShop, uploadShopImage } from '../lib/api'
import { checkImageFile } from '../features/seller/sellerProduct'
import {
  SHOP_STATUS,
  shopErrorMessage,
  shopToForm,
  validateShopForm,
} from '../features/seller/shopForm'

const inputClass =
  'w-full rounded-lg border bg-surface px-3 text-sm focus:border-blue-500 focus:outline-none'

// /tai-khoan/mo-shop (US-14.1): khách hàng đăng ký mở shop; shop bị từ chối thì sửa và gửi lại;
// shop đang chờ duyệt vẫn sửa được tên, mô tả, logo. RoleRoute (App.jsx) bắt đăng nhập.
export default function OpenShop() {
  const { user } = useAuth()
  const shop = useAsync(() => getMyShop(user.id), [user.id])

  if (shop.loading) return <p className="py-16 text-center text-slate-500">Đang tải…</p>
  if (shop.error)
    return (
      <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
        Không tải được shop: {shop.error.message}
      </p>
    )

  const status = shop.data?.status
  if (status === 'active' || status === 'locked') {
    return (
      <div className="mx-auto max-w-xl space-y-3 py-8 text-center">
        <h1 className="text-xl font-bold">Bạn đã có shop “{shop.data.name}”</h1>
        <p className="text-slate-600">Quản lý shop ở Kênh người bán.</p>
        <Link
          to="/kenh-nguoi-ban"
          className="inline-flex h-11 items-center rounded-lg bg-blue-600 px-4 font-semibold text-white hover:bg-blue-700"
        >
          Vào kênh người bán
        </Link>
      </div>
    )
  }
  return <ShopForm shop={shop.data} />
}

function ShopForm({ shop }) {
  const navigate = useNavigate()
  const [form, setForm] = useState(() => shopToForm(shop))
  const [logoFile, setLogoFile] = useState(null) // ảnh mới chọn, tải lên khi gửi
  const [preview, setPreview] = useState(shop?.logo_url ?? '')
  const [errors, setErrors] = useState({})
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)
  const fileRef = useRef(null)
  const rejected = shop?.status === 'rejected'

  // Thu hồi link xem trước của ảnh cũ để không rò bộ nhớ.
  useEffect(() => () => preview.startsWith('blob:') && URL.revokeObjectURL(preview), [preview])

  const set = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm({ ...form, [key]: value })
    setErrors({ ...errors, [key]: undefined })
  }

  const pickLogo = (e) => {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    const problem = checkImageFile(file)
    setErrors({ ...errors, logo: problem ?? undefined })
    if (problem) return
    setLogoFile(file)
    setPreview(URL.createObjectURL(file))
  }
  const removeLogo = () => {
    setLogoFile(null)
    setPreview('')
    setForm({ ...form, logo_url: '' })
  }

  const submit = async (e) => {
    e.preventDefault()
    const { data, errors: found } = validateShopForm(form)
    setErrors(found)
    if (Object.keys(found).length) {
      document.getElementById(`shop-${Object.keys(found)[0]}`)?.focus()
      return
    }
    setSaving(true)
    setSaveError('')
    try {
      let saved
      if (shop) {
        // Logo tải vào thư mục shop (Storage chỉ cho chủ shop ghi vào <shop_id>/).
        if (logoFile) data.logo_url = await uploadShopImage(shop.id, logoFile)
        saved = await updateShop(shop.id, data, { resubmit: rejected })
      } else {
        // Shop mới chưa có id → tạo shop trước, có id rồi mới tải logo.
        saved = await createShop({ ...data, logo_url: null })
        if (logoFile) {
          try {
            const url = await uploadShopImage(saved.id, logoFile)
            saved = await updateShop(saved.id, { logo_url: url })
          } catch {
            // Shop đã tạo xong; logo bổ sung sau ở trang này cũng được.
          }
        }
      }
      const notice =
        shop && !rejected
          ? `Đã lưu thông tin shop “${saved.name}”.`
          : `Đã gửi đăng ký shop “${saved.name}”. Admin sẽ duyệt sớm.`
      navigate('/tai-khoan', { state: { notice } })
    } catch (err) {
      setSaveError(shopErrorMessage(err))
      setSaving(false)
    }
  }

  const border = (key) => (errors[key] ? 'border-red-400' : 'border-slate-300')
  const fieldError = (key) =>
    errors[key] && (
      <span id={`shop-${key}-error`} className="mt-1 block text-sm text-red-600 dark:text-red-400">
        {errors[key]}
      </span>
    )

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">
          {shop ? 'Sửa thông tin shop' : 'Mở shop trên HcmusWare'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Admin duyệt shop trước khi bạn đăng được sản phẩm. Sau khi duyệt, tài khoản của bạn có
          thêm Kênh người bán.
        </p>
      </div>

      {shop && (
        <div className="space-y-1 rounded-lg border border-slate-200 bg-surface p-3 text-sm">
          <p>
            Trạng thái:{' '}
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${SHOP_STATUS[shop.status]?.className}`}
            >
              {SHOP_STATUS[shop.status]?.label}
            </span>
          </p>
          {rejected && shop.review_note && (
            <p className="text-red-700">
              Lý do từ chối: <span className="whitespace-pre-line">{shop.review_note}</span>
            </p>
          )}
        </div>
      )}

      <form
        onSubmit={submit}
        noValidate
        className="space-y-4 rounded-2xl border border-slate-200 bg-surface p-5 sm:p-6"
      >
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Tên shop *</span>
          <input
            id="shop-name"
            value={form.name}
            onChange={set('name')}
            maxLength={80}
            aria-invalid={errors.name ? 'true' : undefined}
            aria-describedby={errors.name ? 'shop-name-error' : undefined}
            className={`${inputClass} h-11 ${border('name')}`}
          />
          {fieldError('name')}
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Mô tả</span>
          <textarea
            id="shop-description"
            rows={4}
            value={form.description}
            onChange={set('description')}
            maxLength={2000}
            placeholder="Shop bán gì, cam kết bảo hành, giờ làm việc…"
            className={`${inputClass} py-2 ${border('description')}`}
          />
          <span className="mt-1 block text-right text-xs text-slate-500">
            {form.description.length}/2000
          </span>
          {fieldError('description')}
        </label>

        <div className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">Logo</span>
          <div className="flex items-center gap-3">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white">
              {preview ? (
                <img src={preview} alt="Logo shop" className="h-full w-full object-contain" />
              ) : (
                <span className="text-2xl font-bold text-slate-500">
                  {form.name.trim()[0]?.toUpperCase() ?? '?'}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                id="shop-logo"
                type="button"
                onClick={() => fileRef.current.click()}
                className="h-11 rounded-lg border border-slate-300 px-3 font-medium hover:bg-slate-50"
              >
                {preview ? 'Đổi logo' : 'Chọn logo'}
              </button>
              {preview && (
                <button
                  type="button"
                  onClick={removeLogo}
                  className="h-11 rounded-lg px-3 text-slate-600 hover:bg-slate-100"
                >
                  Bỏ logo
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={pickLogo}
              className="hidden"
            />
          </div>
          <span className="mt-1 block text-xs text-slate-500">
            Không bắt buộc. JPG, PNG hoặc WebP, tối đa 2 MB.
          </span>
          {fieldError('logo')}
        </div>

        <details className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          <summary className="cursor-pointer font-medium text-slate-700">
            Quy định người bán
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Chỉ bán linh kiện máy tính chính hãng, đúng mô tả và thông số.</li>
            <li>Sản phẩm mới và sản phẩm đổi thông số phải chờ admin duyệt mới hiện trên web.</li>
            <li>Giữ tồn kho đúng thực tế, xác nhận đơn trong 24 giờ.</li>
            <li>Admin có thể ẩn sản phẩm hoặc khóa shop vi phạm.</li>
          </ul>
        </details>
        <label className="flex min-h-11 items-start gap-2 text-sm">
          <input
            id="shop-agree"
            type="checkbox"
            checked={form.agree}
            onChange={set('agree')}
            className="mt-0.5 h-5 w-5 shrink-0 accent-blue-600"
          />
          <span>
            Tôi đã đọc và đồng ý Quy định người bán.
            {fieldError('agree')}
          </span>
        </label>

        {saveError && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {saveError}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Link
            to="/tai-khoan"
            className="inline-flex h-11 items-center justify-center rounded-lg px-4 text-sm text-slate-600 hover:bg-slate-100"
          >
            Hủy
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="h-11 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving
              ? 'Đang gửi…'
              : rejected
                ? 'Gửi lại để duyệt'
                : shop
                  ? 'Lưu thay đổi'
                  : 'Gửi đăng ký'}
          </button>
        </div>
      </form>
    </div>
  )
}
