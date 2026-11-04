import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAsync } from '../../hooks/useAsync'
import {
  createBrand,
  deleteBrand,
  getAdminBrands,
  updateBrand,
  uploadBrandLogo,
} from '../../lib/api'
import { normalizeText } from '../../lib/productFilters'
import { checkImageFile } from '../../features/seller/sellerProduct'
import {
  brandErrorMessage,
  deleteBlockedMessage,
  validateBrandName,
} from '../../features/admin/brandForm'
import LogoBadge from '../../components/LogoBadge'
import { t } from '../../lib/i18n'

const inputClass =
  'h-11 w-full rounded-lg border bg-surface px-3 text-sm focus:border-blue-500 focus:outline-none'
const btn = {
  primary:
    'inline-flex h-11 shrink-0 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60',
  outline:
    'inline-flex h-11 shrink-0 items-center justify-center rounded-lg border border-slate-300 px-3 text-sm font-medium hover:bg-slate-50 disabled:opacity-60',
  danger:
    'inline-flex h-11 shrink-0 items-center justify-center rounded-lg border border-red-300 px-3 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60',
}

// /admin/thuong-hieu (US-15.6): thêm, sửa tên và logo, xóa thương hiệu.
// Tên trùng (không phân biệt hoa thường, dấu) bị chặn: form kiểm tra trước, DB chặn bằng slug unique.
// Thương hiệu còn sản phẩm không xóa được: form báo số sản phẩm, DB chặn bằng khóa ngoại.
export default function AdminBrands() {
  const [reload, setReload] = useState(0)
  const brands = useAsync(getAdminBrands, [reload])
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(null) // id thương hiệu đang sửa
  const [message, setMessage] = useState(null)

  const list = useMemo(() => {
    const q = normalizeText(query)
    return (brands.data ?? []).filter((b) => !q || normalizeText(b.name).includes(q))
  }, [brands.data, query])

  const done = (text) => {
    setMessage({ type: 'success', text })
    setEditing(null)
    setReload((n) => n + 1)
  }

  const remove = async (b) => {
    const blocked = deleteBlockedMessage(b.product_count)
    if (blocked)
      return setMessage({
        type: 'error',
        text: t('Không xóa được “{name}”. {reason}', { name: b.name, reason: blocked }),
      })
    if (!window.confirm(t('Xóa thương hiệu “{name}”?', b))) return
    try {
      await deleteBrand(b.id)
      done(t('Đã xóa thương hiệu “{name}”.', b))
    } catch (err) {
      setMessage({ type: 'error', text: brandErrorMessage(err) })
    }
  }

  return (
    <div className="space-y-3">
      <BrandForm
        key={`moi-${reload}`}
        brands={brands.data ?? []}
        submitLabel={t('Thêm thương hiệu')}
        onSave={async ({ name, logo_url }) => {
          await createBrand(name, logo_url)
          done(t('Đã thêm thương hiệu “{name}”.', { name }))
        }}
      />

      {message && (
        <p
          role={message.type === 'error' ? 'alert' : 'status'}
          className={`rounded-lg p-3 text-sm ${message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-800'}`}
        >
          {message.text}
        </p>
      )}

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('Tìm thương hiệu…')}
        aria-label={t('Tìm thương hiệu')}
        className={`${inputClass} border-slate-300`}
      />

      {brands.loading && (
        <p className="py-8 text-center text-slate-500">{t('Đang tải thương hiệu…')}</p>
      )}
      {brands.error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {t('Không tải được: {msg}', { msg: t(brands.error.message) })}
        </p>
      )}
      {brands.data && !list.length && (
        <p className="py-8 text-center text-sm text-slate-500">
          {brands.data.length ? t('Không có thương hiệu nào khớp.') : t('Chưa có thương hiệu nào.')}
        </p>
      )}
      {brands.data && list.length > 0 && (
        <p className="text-xs text-slate-500">
          {t('{shown} / {n} thương hiệu', { shown: list.length, n: brands.data.length })}
        </p>
      )}

      {list.length > 0 && (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-surface">
          {list.map((b) =>
            editing === b.id ? (
              <li key={b.id} className="p-3">
                <BrandForm
                  brand={b}
                  brands={brands.data}
                  submitLabel={t('Lưu')}
                  onCancel={() => setEditing(null)}
                  onSave={async (fields) => {
                    const saved = await updateBrand(b.id, fields)
                    done(t('Đã lưu thương hiệu “{name}”.', saved))
                  }}
                />
              </li>
            ) : (
              <li key={b.id} className="flex flex-wrap items-center gap-3 p-3">
                <LogoBadge name={b.name} url={b.logo_url} size="h-12 w-12" />
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/thuong-hieu/${b.slug}`}
                    className="text-sm font-medium hover:text-blue-700 hover:underline dark:hover:text-blue-300"
                  >
                    {b.name}
                  </Link>
                  <p className="text-xs text-slate-500">
                    /thuong-hieu/{b.slug} · {t('{n} sản phẩm', { n: b.product_count })}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={btn.outline}
                    onClick={() => {
                      setEditing(b.id)
                      setMessage(null)
                    }}
                  >
                    {t('Sửa')}
                  </button>
                  <button type="button" className={btn.danger} onClick={() => remove(b)}>
                    {t('Xóa')}
                  </button>
                </div>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  )
}

// Form thêm (không có brand) hoặc sửa một thương hiệu: tên + logo (không bắt buộc).
// onSave({ name, logo_url }) ném lỗi thì form hiện lỗi và giữ nguyên dữ liệu đã nhập.
function BrandForm({ brand, brands, submitLabel, onSave, onCancel }) {
  const [name, setName] = useState(brand?.name ?? '')
  const [logoFile, setLogoFile] = useState(null)
  const [preview, setPreview] = useState(brand?.logo_url ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const fileRef = useRef(null)
  const idPrefix = `brand-${brand?.id ?? 'moi'}`

  // Thu hồi link xem trước của ảnh cũ để không rò bộ nhớ.
  useEffect(() => () => preview.startsWith('blob:') && URL.revokeObjectURL(preview), [preview])

  const pickLogo = (e) => {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    const problem = checkImageFile(file)
    setError(problem ?? '')
    if (problem) return
    setLogoFile(file)
    setPreview(URL.createObjectURL(file))
  }

  const submit = async (e) => {
    e.preventDefault()
    const { data, error: found } = validateBrandName(name, brands, brand?.id ?? null)
    if (found) {
      setError(found)
      document.getElementById(`${idPrefix}-name`)?.focus()
      return
    }
    setSaving(true)
    setError('')
    try {
      // Ảnh mới thì tải lên trước; bỏ logo thì gửi null; không đổi thì giữ link cũ.
      const logo_url = logoFile ? await uploadBrandLogo(logoFile) : preview || null
      await onSave({ name: data.name, logo_url })
    } catch (err) {
      setError(brandErrorMessage(err))
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className={`space-y-2 ${brand ? '' : 'rounded-xl border border-slate-200 bg-surface p-4'}`}
    >
      {!brand && <h2 className="font-semibold">{t('Thêm thương hiệu')}</h2>}
      <div className="flex flex-wrap items-center gap-2">
        <LogoBadge name={name} url={preview} size="h-11 w-11" text="text-lg" />
        <label htmlFor={`${idPrefix}-name`} className="sr-only">
          {t('Tên thương hiệu')}
        </label>
        <input
          id={`${idPrefix}-name`}
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setError('')
          }}
          maxLength={60}
          placeholder={t('Tên thương hiệu, vd Cooler Master')}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${idPrefix}-error` : undefined}
          className={`${inputClass} min-w-0 flex-1 basis-48 ${error ? 'border-red-400' : 'border-slate-300'}`}
        />
        <button type="button" className={btn.outline} onClick={() => fileRef.current.click()}>
          {preview ? t('Đổi logo') : t('Chọn logo')}
        </button>
        {preview && (
          <button
            type="button"
            className={btn.outline}
            onClick={() => {
              setLogoFile(null)
              setPreview('')
            }}
          >
            {t('Bỏ logo')}
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={pickLogo}
          className="hidden"
        />
        <button type="submit" disabled={saving} className={btn.primary}>
          {saving ? t('Đang lưu…') : submitLabel}
        </button>
        {onCancel && (
          <button type="button" className={btn.outline} onClick={onCancel}>
            {t('Hủy')}
          </button>
        )}
      </div>
      <p className="text-xs text-slate-500">
        {t('Logo không bắt buộc: JPG, PNG hoặc WebP, tối đa 2 MB.')}
      </p>
      {error && (
        <p id={`${idPrefix}-error`} role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </form>
  )
}
