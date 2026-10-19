import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import ProductGrid from '../components/ProductGrid'
import ProductFilters from '../components/ProductFilters'
import NotFound from './NotFound'
import { getCategoryBySlug, getProducts } from '../lib/api'
import { useAsync } from '../hooks/useAsync'
import {
  SORT_OPTIONS,
  applyFilters,
  buildFacets,
  countActiveFilters,
  readFilters,
} from '../lib/productFilters'

// Danh sách sản phẩm (tất cả hoặc theo danh mục) có tìm kiếm, bộ lọc, sắp xếp.
// Toàn bộ bộ lọc nằm trên URL, vd: /danh-muc/cpu?q=ryzen&s_socket=AM5&sort=price-asc
export default function Products() {
  const { slug } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const [showFilters, setShowFilters] = useState(false) // khung bộ lọc trên điện thoại

  // Trang "Tất cả sản phẩm" không có slug thì không cần tải danh mục.
  const category = useAsync(() => (slug ? getCategoryBySlug(slug) : Promise.resolve(null)), [slug])
  const products = useAsync(() => getProducts({ categorySlug: slug }), [slug])

  const filters = useMemo(() => readFilters(searchParams), [searchParams])
  const facets = useMemo(() => buildFacets(products.data ?? [], slug), [products.data, slug])
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

  if (slug) {
    if (category.loading) {
      return (
        <div>
          <div className="mb-4 h-7 w-40 animate-pulse rounded bg-slate-200" />
          <ProductGrid loading />
        </div>
      )
    }
    if (category.error) {
      return (
        <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
          Không tải được danh mục: {category.error.message}
        </p>
      )
    }
    // Slug không khớp danh mục nào → 404 thay vì trang rỗng.
    if (!category.data) return <NotFound />
  }

  const title = slug ? category.data.name : 'Tất cả sản phẩm'
  const filterProps = { facets, filters, onPrice, onToggle, onStock, onClear, activeCount }

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">{title}</h1>

      {/* Thanh công cụ: tìm kiếm + sắp xếp (+ nút bộ lọc trên điện thoại) */}
      <div className="mb-4 flex flex-wrap gap-2">
        <SearchInput
          value={filters.q}
          onChange={onSearch}
          placeholder={slug ? `Tìm trong ${title}...` : 'Tìm sản phẩm theo tên...'}
        />
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          aria-expanded={showFilters}
          className="h-11 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium sm:flex-none lg:hidden"
        >
          Bộ lọc{activeCount > 0 && ` (${activeCount})`}
        </button>
        <select
          value={filters.sort}
          onChange={(e) => onSort(e.target.value)}
          aria-label="Sắp xếp"
          className="h-11 flex-1 rounded-lg border border-slate-300 bg-white px-2 text-sm sm:flex-none"
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
          className={`${showFilters ? 'block' : 'hidden'} mb-4 rounded-xl border border-slate-200 bg-white p-3 lg:sticky lg:top-32 lg:mb-0 lg:block lg:max-h-[calc(100vh-9rem)] lg:w-64 lg:shrink-0 lg:overflow-y-auto`}
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
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
              <p className="text-slate-600">Không có sản phẩm phù hợp với bộ lọc.</p>
              <button
                type="button"
                onClick={() => setSearchParams({})}
                className="mt-3 min-h-11 rounded-lg px-4 text-sm font-medium text-blue-700 hover:bg-blue-50"
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
      className="h-11 min-w-0 flex-1 basis-full rounded-lg border border-slate-300 bg-white px-3 text-sm focus:border-blue-500 focus:outline-none sm:basis-auto"
    />
  )
}
