import { useMemo, useState } from 'react'
import { applyFilters } from '../../lib/productFilters'
import { formatPrice } from '../../lib/format'
import { categoryImage, thumbUrl } from '../../lib/images'
import { specRows } from '../../lib/specs'
import { checkCompatibility } from './compatibility'

const SORTS = [
  { value: 'price-asc', label: 'Giá thấp → cao' },
  { value: 'price-desc', label: 'Giá cao → thấp' },
  { value: 'name', label: 'Tên A → Z' },
]

// Danh sách linh kiện để chọn cho một dòng của Builder (dùng trong hộp thoại trên máy tính
// và ngay trong từng bước trên điện thoại).
// candidates: đã lọc theo socket/chuẩn RAM/kích thước (filterCandidates); filters: mô tả bộ lọc đang áp dụng.
// Mỗi linh kiện được thử ghép vào cấu hình hiện tại: nếu gây lỗi (vd VGA dài hơn case) thì hiện lý do ngay.
export default function PartPicker({
  slug,
  candidates,
  filters,
  build,
  ramQty,
  selectedId,
  onSelect,
}) {
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('price-asc')

  const list = useMemo(
    () =>
      applyFilters(candidates, {
        q,
        sort,
        min: null,
        max: null,
        brands: [],
        inStock: false,
        specs: {},
      }),
    [candidates, q, sort],
  )

  return (
    <div className="space-y-3">
      {filters.length > 0 && (
        <p className="rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-800">
          Chỉ hiện linh kiện tương thích: {filters.join(' · ')}
        </p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm theo tên, hãng..."
          aria-label="Tìm linh kiện"
          className="h-11 w-full rounded-lg border border-slate-300 px-3 sm:flex-1 text-sm focus:border-blue-500 focus:outline-none"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          aria-label="Sắp xếp"
          className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {list.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">
          {candidates.length ? 'Không có linh kiện khớp từ khóa.' : 'Chưa có linh kiện phù hợp.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {list.map((p) => (
            <PartOption
              key={p.id}
              product={p}
              slug={slug}
              selected={p.id === selectedId}
              conflict={conflictFor(slug, p, build, ramQty)}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

// Lỗi tương thích (nếu có) khi đặt linh kiện p vào dòng slug của cấu hình hiện tại.
function conflictFor(slug, p, build, ramQty) {
  const { errors } = checkCompatibility({ ...build, ramQty, [slug]: p })
  // R9 (CPU không có iGPU) không phải lắp sai, chỉ là cần thêm VGA → ghi chú riêng, không tô đỏ.
  return errors.find((e) => e.rule !== 'R9' && e.parts.includes(slug))?.message ?? null
}

function PartOption({ product, slug, selected, conflict, onSelect }) {
  const { name, brand, price, stock, image_url, specs } = product
  const fallback = categoryImage(slug)
  const outOfStock = stock <= 0
  const summary = specRows(slug, specs)
    .slice(0, 3)
    .map((r) => r.value)
    .join(' · ')

  return (
    <li>
      <button
        type="button"
        disabled={outOfStock}
        onClick={() => onSelect(product)}
        aria-pressed={selected}
        className={`flex w-full items-center gap-3 rounded-xl border p-2 text-left transition sm:p-3 ${
          selected
            ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
            : 'border-slate-200 bg-white hover:border-blue-300'
        } disabled:cursor-not-allowed disabled:opacity-60`}
      >
        <img
          src={thumbUrl(image_url) || fallback}
          alt=""
          loading="lazy"
          onError={(e) => {
            if (!e.currentTarget.src.endsWith(fallback)) e.currentTarget.src = fallback
          }}
          className={`h-14 w-14 shrink-0 rounded-lg object-contain ${outOfStock ? 'grayscale' : ''}`}
        />
        <span className="min-w-0 flex-1">
          {brand && (
            <span className="block text-[11px] font-semibold uppercase text-slate-500">
              {brand}
            </span>
          )}
          <span className="line-clamp-2 text-sm font-medium text-slate-900">{name}</span>
          {summary && (
            <span className="mt-0.5 block truncate text-xs text-slate-500">{summary}</span>
          )}
          {conflict && (
            <span className="mt-0.5 block text-xs font-medium text-red-600">⚠ {conflict}</span>
          )}
          {slug === 'cpu' && specs?.igpu === false && (
            <span className="mt-0.5 block text-xs text-slate-500">
              Không có iGPU – cần thêm VGA
            </span>
          )}
        </span>
        <span className="shrink-0 text-right">
          <span className="block whitespace-nowrap text-sm font-semibold text-red-600">
            {formatPrice(price)}
          </span>
          <span className={`block text-xs ${outOfStock ? 'text-slate-500' : 'text-green-700'}`}>
            {outOfStock ? 'Hết hàng' : selected ? '✓ Đang chọn' : `Còn ${stock}`}
          </span>
        </span>
      </button>
    </li>
  )
}
