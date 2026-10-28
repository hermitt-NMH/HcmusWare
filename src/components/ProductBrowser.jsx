import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import ProductGrid from './ProductGrid'
import ProductFilters from './ProductFilters'
import {
  SORT_OPTIONS,
  applyFilters,
  buildFacets,
  countActiveFilters,
  readFilters,
} from '../lib/productFilters'

// Danh sách sản phẩm có tìm kiếm, bộ lọc, sắp xếp – dùng chung cho trang danh mục,
// trang thương hiệu và trang shop. Toàn bộ bộ lọc nằm trên URL, vd ?q=ryzen&s_socket=AM5&sort=price-asc
// products: kết quả useAsync (data, loading, error). categorySlug: có thì hiện bộ lọc thông số của danh mục.
// searchLabel: chữ trong ô tìm kiếm, vd "CPU" → "Tìm trong CPU...".
export default function ProductBrowser({ products, categorySlug, searchLabel }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [showFilters, setShowFilters] = useState(false) // khung bộ lọc trên điện thoại

  const filters = useMemo(() => readFilters(searchParams), [searchParams])
  const facets = useMemo(
    () => buildFacets(products.data ?? [], categorySlug),
    [products.data, categorySlug],
  )
  const visible = useMemo(
    () => applyFilters(products.data ?? [], filters),
    [products.data, filters],
  )
  const activeCount = countActiveFilters(filters)

  // ---- Các hàm cập nhật URL ----
  // replace: true cho ô tìm kiếm để mỗi chữ gõ không tạo thêm một bước "Back".
  const update = (change, replace = false) => {
    const next = new URLSearchParams(searchParams)
    change(next)
    setSearchParams(next, { replace })
  }
  const setOrDelete = (params, key, value) =>
    value == null || value === '' ? params.delete(key) : params.set(key, value)

  const onSearch = (q) => update((p) => setOrDelete(p, 'q', q), true)
  const onSort = (sort) => update((p) => setOrDelete(p, 'sort', sort === 'newest' ? null : sort))
  const onPrice = (min, max) =>
    update((p) => {
      setOrDelete(p, 'min', min)
      setOrDelete(p, 'max', max)
    })
  const onStock = (checked) => update((p) => setOrDelete(p, 'stock', checked ? '1' : null))
  // Tick/bỏ tick một giá trị trong nhóm (hãng, socket...). Một key có thể có nhiều giá trị.
  const onToggle = (key, value) =>
    update((p) => {
      const values = p.getAll(key)
      p.delete(key)
      const next = values.includes(value) ? values.filter((v) => v !== value) : [...values, value]
      next.forEach((v) => p.append(key, v))
    })
  // Xóa bộ lọc nhưng giữ từ khóa tìm kiếm và cách sắp xếp.
  const onClear = () =>
    update((p) => {
      for (const key of [...p.keys()]) if (key !== 'q' && key !== 'sort') p.delete(key)
    })

  const filterProps = { facets, filters, onPrice, onToggle, onStock, onClear, activeCount }

  return (
    <div>
      {/* Thanh công cụ: tìm kiếm + sắp xếp (+ nút bộ lọc trên điện thoại) */}
      <div className="mb-4 flex flex-wrap gap-2">
        <SearchInput
          value={filters.q}
          onChange={onSearch}
          placeholder={searchLabel ? `Tìm trong ${searchLabel}...` : 'Tìm sản phẩm theo tên...'}
        />
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          aria-expanded={showFilters}
          className="h-11 flex-1 rounded-lg border border-slate-300 bg-surface px-3 text-sm font-medium sm:flex-none lg:hidden"
        >
          Bộ lọc{activeCount > 0 && ` (${activeCount})`}
        </button>
        <select
          value={filters.sort}
          onChange={(e) => onSort(e.target.value)}
          aria-label="Sắp xếp"
          className="h-11 flex-1 rounded-lg border border-slate-300 bg-surface px-2 text-sm sm:flex-none"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="lg:flex lg:items-start lg:gap-6">
        {/* Điện thoại/tablet: bấm nút mới hiện; máy tính (lg): luôn hiện bên trái */}
        <aside
          className={`${showFilters ? 'block' : 'hidden'} mb-4 rounded-xl border border-slate-200 bg-surface p-3 lg:sticky lg:top-32 lg:mb-0 lg:block lg:max-h-[calc(100vh-9rem)] lg:w-64 lg:shrink-0 lg:overflow-y-auto`}
        >
          <ProductFilters {...filterProps} />
          <button
            type="button"
            onClick={() => setShowFilters(false)}
            className="mt-2 h-11 w-full rounded-lg bg-blue-600 text-sm font-semibold text-white lg:hidden"
          >
            Xem {visible.length} sản phẩm
          </button>
        </aside>

        <section className="min-w-0 flex-1">
          {products.loading || products.error ? (
            <ProductGrid {...products} />
          ) : !products.data.length ? (
            <ProductGrid products={[]} />
          ) : !visible.length ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-surface p-8 text-center">
              <p className="text-slate-600">Không có sản phẩm phù hợp với bộ lọc.</p>
              <button
                type="button"
                onClick={() => setSearchParams({})}
                className="mt-3 min-h-11 rounded-lg px-4 text-sm font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-50"
              >
                Xóa tìm kiếm và bộ lọc
              </button>
            </div>
          ) : (
            <>
              <p className="mb-3 text-sm text-slate-500">
                {visible.length === products.data.length
                  ? `${visible.length} sản phẩm`
                  : `Tìm thấy ${visible.length} / ${products.data.length} sản phẩm`}
              </p>
              <ProductGrid products={visible} />
            </>
          )}
        </section>
      </div>
    </div>
  )
}

// Ô tìm kiếm có state riêng (draft) thay vì lấy thẳng giá trị từ URL.
// Lý do: React Router cập nhật URL trong startTransition (chậm hơn một nhịp), nếu ô nhập
// đọc giá trị từ URL thì gõ tiếng Việt bằng Telex/VNI có thể bị nhảy chữ hoặc mất dấu.
function SearchInput({ value, onChange, placeholder }) {
  const [draft, setDraft] = useState(value)
  // Giá trị mình vừa đẩy lên URL, để phân biệt với thay đổi đến từ nơi khác.
  const pushed = useRef(value)

  // URL đổi từ nơi khác (ô tìm ở Header, nút "Xóa tìm kiếm", bấm Back) → cập nhật ô nhập.
  useEffect(() => {
    if (value !== pushed.current) {
      pushed.current = value
      setDraft(value)
    }
  }, [value])

  return (
    <input
      type="search"
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value)
        pushed.current = e.target.value
        onChange(e.target.value)
      }}
      placeholder={placeholder}
      aria-label="Tìm sản phẩm theo tên"
      className="h-11 min-w-0 flex-1 basis-full rounded-lg border border-slate-300 bg-surface px-3 text-sm focus:border-blue-500 focus:outline-none sm:basis-auto"
    />
  )
}
