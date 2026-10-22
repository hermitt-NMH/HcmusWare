import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAsync } from '../../hooks/useAsync'
import { deleteProduct, getAdminProducts, getCategories, saveProduct } from '../../lib/api'
import { formatPrice } from '../../lib/format'
import { categoryImage } from '../../lib/images'
import {
  productErrorMessage,
  productToForm,
  validateProductForm,
} from '../../features/admin/productForm'

// Quản lý sản phẩm: tìm, lọc theo danh mục, thêm / sửa / xóa.
// Đổi giá → trigger log_price_change trong DB tự ghi vào price_history (biểu đồ giá cập nhật).
export default function AdminProducts() {
  const [reload, setReload] = useState(0)
  const products = useAsync(getAdminProducts, [reload])
  const categories = useAsync(getCategories)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [editing, setEditing] = useState(null) // null: đóng; {}: thêm mới; product: sửa
  const [message, setMessage] = useState(null)

  const remove = async (p) => {
    if (!window.confirm(`Xóa "${p.name}"? Không hoàn tác được.`)) return
    try {
      await deleteProduct(p.id)
      setMessage({ type: 'success', text: `Đã xóa "${p.name}".` })
      setReload((n) => n + 1)
    } catch (err) {
      setMessage({ type: 'error', text: productErrorMessage(err) })
    }
  }

  const keyword = q.trim().toLowerCase()
  const list = (products.data ?? []).filter(
    (p) =>
      (!cat || p.categories?.slug === cat) &&
      (!keyword || `${p.name} ${p.brand ?? ''}`.toLowerCase().includes(keyword)),
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm theo tên, hãng…"
          aria-label="Tìm sản phẩm"
          className="h-11 flex-1 rounded-lg border border-slate-300 px-3 text-sm focus:border-blue-500 focus:outline-none"
        />
        <select
          value={cat}
          onChange={(e) => setCat(e.target.value)}
          aria-label="Lọc theo danh mục"
          className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="">Tất cả danh mục</option>
          {categories.data?.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setEditing({})}
          disabled={!categories.data}
          className="h-11 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          + Thêm sản phẩm
        </button>
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
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          Không tải được: {products.error.message}
        </p>
      )}
      {products.data && (
        <p className="text-sm text-slate-500">
          {list.length} / {products.data.length} sản phẩm
        </p>
      )}

      <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {list.map((p) => (
          <li key={p.id} className="flex items-center gap-3 p-3">
            <img
              src={p.image_url || categoryImage(p.categories?.slug)}
              alt=""
              loading="lazy"
              className="h-12 w-12 shrink-0 rounded-md border border-slate-100 object-contain"
            />
            <div className="min-w-0 flex-1">
              <Link
                to={`/san-pham/${p.id}`}
                target="_blank"
                className="line-clamp-1 text-sm font-medium hover:text-blue-700"
              >
                {p.name}
              </Link>
              <p className="text-xs text-slate-500">
                #{p.id} · {p.categories?.name} · {p.brand ?? '—'}
              </p>
              <p className="text-sm">
                <span className="font-semibold text-red-600">{formatPrice(p.price)}</span>
                <span
                  className={`ml-2 text-xs ${p.stock <= 0 ? 'font-medium text-red-600' : 'text-slate-500'}`}
                >
                  Kho: {p.stock}
                </span>
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
              <button
                type="button"
                onClick={() => setEditing(p)}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 px-3 text-sm font-medium hover:bg-slate-50"
              >
                Sửa
              </button>
              <button
                type="button"
                onClick={() => remove(p)}
                className="inline-flex h-10 items-center justify-center rounded-lg px-3 text-sm text-slate-500 hover:bg-red-50 hover:text-red-600"
              >
                Xóa
              </button>
            </div>
          </li>
        ))}
      </ul>

      {editing && (
        <ProductDialog
          product={editing.id ? editing : null}
          categories={categories.data ?? []}
          onClose={() => setEditing(null)}
          onSaved={(text) => {
            setEditing(null)
            setMessage({ type: 'success', text })
            setReload((n) => n + 1)
          }}
        />
      )}
    </div>
  )
}

const inputClass =
  'w-full rounded-lg border bg-white px-3 text-sm focus:border-blue-500 focus:outline-none'

function ProductDialog({ product, categories, onClose, onSaved }) {
  const ref = useRef(null)
  const [form, setForm] = useState(() => productToForm(product, categories[0]?.id))
  const [errors, setErrors] = useState({})
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)

  // Giống hộp thoại chọn linh kiện ở Builder: không close() khi dọn dẹp (StrictMode).
  useEffect(() => {
    if (!ref.current.open) ref.current.showModal()
  }, [])

  const set = (key) => (e) => {
    setForm({ ...form, [key]: e.target.value })
    setErrors({ ...errors, [key]: undefined })
  }

  const submit = async (e) => {
    e.preventDefault()
    const { data, errors: found } = validateProductForm(form)
    setErrors(found)
    if (Object.keys(found).length) return
    setSaving(true)
    setSaveError('')
    try {
      await saveProduct(data)
      const priceChanged = product && product.price !== data.price
      onSaved(
        product
          ? `Đã lưu "${data.name}".${priceChanged ? ' Giá mới đã được ghi vào lịch sử giá.' : ''}`
          : `Đã thêm "${data.name}".`,
      )
    } catch (err) {
      setSaveError(productErrorMessage(err))
      setSaving(false)
    }
  }

  const field = (key, label, input, hint) => (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      {input}
      {hint && !errors[key] && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
      {errors[key] && <span className="mt-1 block text-red-600">{errors[key]}</span>}
    </label>
  )
  const border = (key) => (errors[key] ? 'border-red-400' : 'border-slate-300')

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="product-dialog-title"
      className="m-auto w-[min(640px,calc(100vw-2rem))] rounded-2xl p-0 backdrop:bg-slate-900/50"
    >
      <form onSubmit={submit} noValidate className="flex max-h-[90vh] flex-col">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 id="product-dialog-title" className="text-lg font-semibold">
            {product ? `Sửa sản phẩm #${product.id}` : 'Thêm sản phẩm'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto p-5">
          {field(
            'category_id',
            'Danh mục',
            <select
              value={form.category_id}
              onChange={set('category_id')}
              className={`${inputClass} h-11 ${border('category_id')}`}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>,
          )}
          {field(
            'name',
            'Tên sản phẩm',
            <input
              value={form.name}
              onChange={set('name')}
              className={`${inputClass} h-11 ${border('name')}`}
            />,
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            {field(
              'brand',
              'Hãng',
              <input
                value={form.brand}
                onChange={set('brand')}
                className={`${inputClass} h-11 ${border('brand')}`}
              />,
            )}
            {field(
              'price',
              'Giá (VNĐ)',
              <input
                inputMode="numeric"
                value={form.price}
                onChange={set('price')}
                className={`${inputClass} h-11 ${border('price')}`}
              />,
              product ? 'Đổi giá sẽ ghi vào lịch sử giá' : null,
            )}
            {field(
              'stock',
              'Tồn kho',
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={form.stock}
                onChange={set('stock')}
                className={`${inputClass} h-11 ${border('stock')}`}
              />,
            )}
          </div>
          {field(
            'image_url',
            'Ảnh',
            <input
              value={form.image_url}
              onChange={set('image_url')}
              placeholder="/images/products/... hoặc https://..."
              className={`${inputClass} h-11 ${border('image_url')}`}
            />,
          )}
          {field(
            'datasheet_url',
            'Link datasheet',
            <input
              value={form.datasheet_url}
              onChange={set('datasheet_url')}
              placeholder="https://..."
              className={`${inputClass} h-11 ${border('datasheet_url')}`}
            />,
          )}
          {field(
            'description',
            'Mô tả',
            <textarea
              rows={2}
              value={form.description}
              onChange={set('description')}
              className={`${inputClass} py-2 ${border('description')}`}
            />,
          )}
          {field(
            'specs',
            'Thông số (JSON)',
            <textarea
              rows={6}
              value={form.specs}
              onChange={set('specs')}
              spellCheck={false}
              className={`${inputClass} py-2 font-mono text-xs ${border('specs')}`}
            />,
            'Builder dùng các khóa này để kiểm tra tương thích (socket, ram_type, tdp_w...). Xem docs/quy-tac-tuong-thich.md.',
          )}
          {saveError && (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {saveError}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-lg px-4 text-sm text-slate-600 hover:bg-slate-100"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={saving}
            className="h-11 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? 'Đang lưu…' : 'Lưu'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
