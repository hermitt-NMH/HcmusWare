import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAsync } from '../../hooks/useAsync'
import { getBrands, getCategories, getSellerProduct, saveSellerProduct } from '../../lib/api'
import ImageUploader from '../../features/seller/ImageUploader'
import {
  OTHER_BRAND,
  changedFields,
  needsReview,
  sellerProductToForm,
  validateSellerProduct,
} from '../../features/seller/sellerProduct'
import {
  optionLabel,
  optionValue,
  specsToForm,
  visibleSpecFields,
} from '../../features/seller/specFields'
import { productErrorMessage } from '../../features/admin/productForm'
import NotFound from '../NotFound'

const inputClass =
  'w-full rounded-lg border bg-surface px-3 text-sm focus:border-blue-500 focus:outline-none'
// id của ô trên form theo khóa lỗi: "specs.socket" → "f-specs-socket" (để nhảy tới ô lỗi).
const fieldId = (key) => `f-${key.replace('.', '-')}`

// /kenh-nguoi-ban/san-pham/moi và /kenh-nguoi-ban/san-pham/:id (US-14.4, US-14.6).
export default function SellerProductForm({ shop }) {
  const { id } = useParams()
  const categories = useAsync(getCategories)
  const brands = useAsync(getBrands)
  const product = useAsync(
    () => (id ? getSellerProduct(shop.id, id) : Promise.resolve(null)),
    [shop.id, id ?? 'moi'],
  )

  const loading = categories.loading || brands.loading || product.loading
  const error = categories.error || brands.error || product.error
  if (loading) return <p className="py-16 text-center text-slate-500">Đang tải…</p>
  if (error)
    return (
      <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
        Không tải được dữ liệu: {error.message}
      </p>
    )
  if (id && !product.data) return <NotFound />

  return (
    <ProductForm
      key={id ?? 'moi'}
      shop={shop}
      product={product.data}
      categories={categories.data}
      brands={brands.data}
    />
  )
}

function ProductForm({ shop, product, categories, brands }) {
  const navigate = useNavigate()
  const formRef = useRef(null)
  const [form, setForm] = useState(() => sellerProductToForm(product, categories))
  const [specsTouched, setSpecsTouched] = useState(!product)
  const [errors, setErrors] = useState({})
  const [submitted, setSubmitted] = useState(0)
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)

  const slug = categories.find((c) => String(c.id) === form.category_id)?.slug
  // Sản phẩm bị trả lại / bị gỡ: lưu xong gửi duyệt lại luôn.
  const resubmit = product?.status === 'hidden' && !product.approved_at

  // Sau mỗi lần bấm Lưu mà có lỗi: con trỏ nhảy tới ô lỗi đầu tiên (theo thứ tự trên trang).
  useEffect(() => {
    if (submitted) formRef.current?.querySelector('[aria-invalid="true"]')?.focus()
  }, [submitted])

  const clear = (key) => errors[key] && setErrors({ ...errors, [key]: undefined })
  const set = (key) => (e) => {
    setForm({ ...form, [key]: e.target.value })
    clear(key)
  }
  const setSpec = (key, value) => {
    setForm({ ...form, specs: { ...form.specs, [key]: value } })
    setSpecsTouched(true)
    clear(`specs.${key}`)
  }
  const setCategory = (e) => {
    const nextSlug = categories.find((c) => String(c.id) === e.target.value)?.slug
    // Đổi danh mục → bộ thông số khác hẳn, làm lại từ đầu.
    setForm({ ...form, category_id: e.target.value, specs: specsToForm(nextSlug, {}) })
    setSpecsTouched(true)
    setErrors({})
  }

  const submit = async (e) => {
    e.preventDefault()
    const { data, errors: found } = validateSellerProduct(form, slug)
    setErrors(found)
    setSubmitted((n) => n + 1)
    if (Object.keys(found).length) return

    let fields = data
    if (product) {
      fields = changedFields(product, data, specsTouched)
      if (resubmit) fields.status = 'pending'
      if (!Object.keys(fields).length) {
        setSaveError('Bạn chưa thay đổi gì.')
        return
      }
      if (
        product.status === 'active' &&
        needsReview(fields) &&
        !window.confirm(
          'Bạn đã đổi tên, danh mục, thương hiệu hoặc thông số.\nSản phẩm sẽ tạm ẩn đến khi admin duyệt lại. Tiếp tục?',
        )
      )
        return
    }

    setSaving(true)
    setSaveError('')
    try {
      const saved = await saveSellerProduct(shop.id, product?.id, fields)
      const notice = !product
        ? `Đã đăng “${saved.name}”. Sản phẩm chờ admin duyệt trước khi hiện trên web.`
        : saved.status === 'pending' && product.status !== 'pending'
          ? `Đã lưu “${saved.name}” và gửi admin duyệt lại.`
          : `Đã lưu “${saved.name}”.`
      navigate('/kenh-nguoi-ban', { state: { notice } })
    } catch (err) {
      setSaveError(productErrorMessage(err))
      setSaving(false)
    }
  }

  // Một ô của form: nhãn, ô nhập, gợi ý, lỗi.
  const field = (key, label, input, hint) => (
    <div className="text-sm">
      <label htmlFor={fieldId(key)} className="mb-1 block font-medium text-slate-700">
        {label}
      </label>
      {input}
      {hint && !errors[key] && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
      {errors[key] && (
        <span id={`${fieldId(key)}-error`} className="mt-1 block text-red-600 dark:text-red-400">
          {errors[key]}
        </span>
      )}
    </div>
  )
  // Thuộc tính chung cho ô nhập: id, viền đỏ khi lỗi, aria cho trình đọc màn hình.
  const attrs = (key) => ({
    id: fieldId(key),
    'aria-invalid': errors[key] ? 'true' : undefined,
    'aria-describedby': errors[key] ? `${fieldId(key)}-error` : undefined,
  })
  const border = (key) => (errors[key] ? 'border-red-400' : 'border-slate-300')

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <nav className="text-sm">
        <Link
          to="/kenh-nguoi-ban"
          className="inline-flex min-h-11 items-center text-blue-700 hover:underline dark:text-blue-300"
        >
          ← Kênh người bán
        </Link>
      </nav>
      <h1 className="text-xl font-bold sm:text-2xl">
        {product ? `Sửa sản phẩm #${product.id}` : 'Đăng sản phẩm'}
      </h1>
      {product?.review_note && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          Admin trả lại: <span className="whitespace-pre-line">{product.review_note}</span>
        </p>
      )}
      {product?.status === 'active' && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          Đổi giá, tồn kho, ảnh, mô tả: áp dụng ngay. Đổi tên, danh mục, thương hiệu hoặc thông số:
          sản phẩm tạm ẩn đến khi admin duyệt lại.
        </p>
      )}

      <form ref={formRef} onSubmit={submit} noValidate className="space-y-4">
        <section className="space-y-3 rounded-2xl border border-slate-200 bg-surface p-5">
          <h2 className="font-semibold">Thông tin chung</h2>
          {field(
            'category_id',
            'Danh mục *',
            <select
              {...attrs('category_id')}
              value={form.category_id}
              onChange={setCategory}
              className={`${inputClass} h-11 ${border('category_id')}`}
            >
              <option value="">— Chọn danh mục —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>,
            'Chọn trước: ô thông số bên dưới đổi theo danh mục.',
          )}
          {field(
            'name',
            'Tên sản phẩm *',
            <input
              {...attrs('name')}
              value={form.name}
              onChange={set('name')}
              maxLength={200}
              className={`${inputClass} h-11 ${border('name')}`}
            />,
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {field(
              'brand_id',
              'Thương hiệu *',
              <select
                {...attrs('brand_id')}
                value={form.brand_id}
                onChange={set('brand_id')}
                className={`${inputClass} h-11 ${border('brand_id')}`}
              >
                <option value="">— Chọn thương hiệu —</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
                <option value={OTHER_BRAND}>Thương hiệu khác…</option>
              </select>,
            )}
            {form.brand_id === OTHER_BRAND &&
              field(
                'other_brand',
                'Tên thương hiệu *',
                <input
                  {...attrs('other_brand')}
                  value={form.other_brand}
                  onChange={set('other_brand')}
                  maxLength={60}
                  className={`${inputClass} h-11 ${border('other_brand')}`}
                />,
                'Admin sẽ thêm thương hiệu này khi duyệt sản phẩm.',
              )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {field(
              'price',
              'Giá (VNĐ) *',
              <input
                {...attrs('price')}
                inputMode="numeric"
                value={form.price}
                onChange={set('price')}
                placeholder="1990000"
                className={`${inputClass} h-11 ${border('price')}`}
              />,
              product ? 'Đổi giá sẽ ghi vào lịch sử giá.' : '1.000 – 200.000.000 ₫',
            )}
            {field(
              'stock',
              'Tồn kho *',
              <input
                {...attrs('stock')}
                type="number"
                min="0"
                max="9999"
                inputMode="numeric"
                value={form.stock}
                onChange={set('stock')}
                className={`${inputClass} h-11 ${border('stock')}`}
              />,
            )}
          </div>
          <ImageUploader
            id={fieldId('images')}
            shopId={shop.id}
            images={form.images}
            onChange={(images) => {
              setForm({ ...form, images })
              clear('images')
            }}
            label="Ảnh sản phẩm * (ảnh đầu tiên là ảnh đại diện)"
            error={errors.images}
          />
          {field(
            'description',
            'Mô tả',
            <textarea
              {...attrs('description')}
              rows={4}
              value={form.description}
              onChange={set('description')}
              maxLength={5000}
              className={`${inputClass} py-2 ${border('description')}`}
            />,
            'Hiển thị dạng chữ thường, không nhận HTML.',
          )}
          {field(
            'datasheet_url',
            'Link datasheet',
            <input
              {...attrs('datasheet_url')}
              type="url"
              value={form.datasheet_url}
              onChange={set('datasheet_url')}
              placeholder="https://..."
              className={`${inputClass} h-11 ${border('datasheet_url')}`}
            />,
          )}
        </section>

        {slug && (
          <section className="space-y-3 rounded-2xl border border-slate-200 bg-surface p-5">
            <div>
              <h2 className="font-semibold">Thông số kỹ thuật</h2>
              <p className="text-xs text-slate-500">
                Build PC dùng các thông số này để kiểm tra tương thích. Ô có * là bắt buộc.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {visibleSpecFields(slug, form.specs).map((f) => (
                <SpecField
                  key={f.key}
                  field={f}
                  value={form.specs[f.key]}
                  onChange={(v) => setSpec(f.key, v)}
                  error={errors[`specs.${f.key}`]}
                  attrs={attrs(`specs.${f.key}`)}
                  border={border(`specs.${f.key}`)}
                />
              ))}
            </div>
          </section>
        )}

        {saveError && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {saveError}
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Link
            to="/kenh-nguoi-ban"
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
              ? 'Đang lưu…'
              : !product
                ? 'Đăng và gửi duyệt'
                : resubmit
                  ? 'Lưu và gửi duyệt lại'
                  : 'Lưu thay đổi'}
          </button>
        </div>
      </form>
    </div>
  )
}

// Một ô thông số theo kiểu khai báo trong specFields.js.
function SpecField({ field, value, onChange, error, attrs, border }) {
  const label = `${field.label}${field.unit ? ` (${field.unit})` : ''}${field.required ? ' *' : ''}`
  const hint = field.hint ?? (field.range ? `Từ ${field.range[0]} đến ${field.range[1]}` : null)
  let input
  if (field.type === 'multi') {
    const selected = value ?? []
    input = (
      <div {...attrs} tabIndex={-1} role="group" className="flex flex-wrap gap-x-4 rounded-lg">
        {field.options.map((o) => {
          const v = optionValue(o)
          return (
            <label key={v} className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected.includes(v)}
                onChange={(e) =>
                  onChange(e.target.checked ? [...selected, v] : selected.filter((x) => x !== v))
                }
                className="h-5 w-5 accent-blue-600"
              />
              {optionLabel(o)}
            </label>
          )
        })}
      </div>
    )
  } else if (field.type === 'select' || field.type === 'bool') {
    const options =
      field.type === 'bool'
        ? [
            { value: 'true', label: 'Có' },
            { value: 'false', label: 'Không' },
          ]
        : field.options
    input = (
      <select
        {...attrs}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} h-11 ${border}`}
      >
        <option value="">— Chọn —</option>
        {options.map((o) => (
          <option key={optionValue(o)} value={optionValue(o)}>
            {optionLabel(o)}
          </option>
        ))}
      </select>
    )
  } else {
    input = (
      <input
        {...attrs}
        inputMode={
          field.type === 'int' ? 'numeric' : field.type === 'decimal' ? 'decimal' : undefined
        }
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        className={`${inputClass} h-11 ${border}`}
      />
    )
  }
  return (
    <div className={`text-sm ${field.type === 'multi' ? 'sm:col-span-2' : ''}`}>
      {field.type === 'multi' ? (
        <span className="mb-1 block font-medium text-slate-700">{label}</span>
      ) : (
        <label htmlFor={attrs.id} className="mb-1 block font-medium text-slate-700">
          {label}
        </label>
      )}
      {input}
      {hint && !error && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
      {error && (
        <span id={`${attrs.id}-error`} className="mt-1 block text-red-600 dark:text-red-400">
          {error}
        </span>
      )}
    </div>
  )
}
