import { useState } from 'react'

// Các khoảng giá chọn nhanh (VNĐ). max null = không giới hạn.
const PRICE_RANGES = [
  { label: 'Mọi mức giá', min: null, max: null },
  { label: 'Dưới 2 triệu', min: null, max: 2_000_000 },
  { label: '2 – 5 triệu', min: 2_000_000, max: 5_000_000 },
  { label: '5 – 10 triệu', min: 5_000_000, max: 10_000_000 },
  { label: '10 – 20 triệu', min: 10_000_000, max: 20_000_000 },
  { label: 'Trên 20 triệu', min: 20_000_000, max: null },
]

const MILLION = 1_000_000

// Ô tick có vùng bấm cao 44px (min-h-11) để dễ chạm trên điện thoại.
function CheckOption({ checked, onChange, label, count, type = 'checkbox', name }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-2 text-sm hover:bg-slate-50">
      <input
        type={type}
        name={name}
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 shrink-0 accent-blue-600"
      />
      <span className="flex-1">{label}</span>
      {count != null && <span className="text-xs text-slate-400">{count}</span>}
    </label>
  )
}

function Group({ title, children }) {
  return (
    <fieldset className="border-t border-slate-100 py-3 first:border-t-0 first:pt-0">
      <legend className="mb-1 px-2 text-sm font-semibold text-slate-900">{title}</legend>
      {children}
    </fieldset>
  )
}

// Ô nhập khoảng giá tùy chọn, tính bằng triệu đồng cho dễ gõ (vd 3.5 = 3.500.000 ₫).
// Có state riêng để gõ dở (vd "3.") không bị nhảy; bấm "Áp dụng" mới đổi bộ lọc.
// Bộ lọc giá đổi từ chỗ khác (chọn nhanh, xóa lọc) thì ô nhập tự đồng bộ lại.
function PriceInputs({ min, max, onApply }) {
  const toInput = (v) => (v == null ? '' : String(v / MILLION))
  const [draft, setDraft] = useState({ min: toInput(min), max: toInput(max) })
  const [synced, setSynced] = useState({ min, max })
  if (synced.min !== min || synced.max !== max) {
    setSynced({ min, max })
    setDraft({ min: toInput(min), max: toInput(max) })
  }

  const submit = (e) => {
    e.preventDefault()
    const toVnd = (v) => (v === '' || isNaN(Number(v)) ? null : Math.round(Number(v) * MILLION))
    let from = toVnd(draft.min)
    let to = toVnd(draft.max)
    // Gõ ngược (từ 10 đến 5) thì tự đảo lại.
    if (from != null && to != null && from > to) [from, to] = [to, from]
    onApply(from, to)
  }

  const inputClass =
    'h-11 w-full min-w-0 rounded-md border border-slate-300 px-2 text-sm focus:border-blue-500 focus:outline-none'
  return (
    <form onSubmit={submit} className="mt-2 flex items-center gap-2 px-2">
      <input
        type="number"
        inputMode="decimal"
        min="0"
        step="0.1"
        placeholder="Từ"
        aria-label="Giá từ (triệu đồng)"
        value={draft.min}
        onChange={(e) => setDraft({ ...draft, min: e.target.value })}
        className={inputClass}
      />
      <span className="text-slate-400">–</span>
      <input
        type="number"
        inputMode="decimal"
        min="0"
        step="0.1"
        placeholder="Đến"
        aria-label="Giá đến (triệu đồng)"
        value={draft.max}
        onChange={(e) => setDraft({ ...draft, max: e.target.value })}
        className={inputClass}
      />
      <button
        type="submit"
        className="h-11 shrink-0 rounded-md bg-gray-800 px-3 text-sm font-medium text-white hover:bg-gray-700"
      >
        Áp dụng
      </button>
    </form>
  )
}

// Bộ lọc bên trái trang danh mục.
// facets: { brands, specs } từ buildFacets; filters: từ readFilters.
// Các hàm on... do trang cha truyền xuống để cập nhật URL.
export default function ProductFilters({
  facets,
  filters,
  onPrice,
  onToggle,
  onStock,
  onClear,
  activeCount,
}) {
  const isRange = (r) => filters.min === r.min && filters.max === r.max

  return (
    <div>
      <div className="mb-3 flex items-center justify-between px-2">
        <h2 className="font-semibold">Bộ lọc</h2>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="min-h-11 text-sm text-blue-700 dark:text-blue-300 hover:underline"
          >
            Xóa tất cả ({activeCount})
          </button>
        )}
      </div>

      <Group title="Tình trạng">
        <CheckOption
          checked={filters.inStock}
          onChange={(e) => onStock(e.target.checked)}
          label="Chỉ hiện còn hàng"
        />
      </Group>

      <Group title="Khoảng giá">
        {PRICE_RANGES.map((r) => (
          <CheckOption
            key={r.label}
            type="radio"
            name="price-range"
            checked={isRange(r)}
            onChange={() => onPrice(r.min, r.max)}
            label={r.label}
          />
        ))}
        <PriceInputs min={filters.min} max={filters.max} onApply={onPrice} />
      </Group>

      {facets.brands.length > 1 && (
        <Group title="Hãng">
          {facets.brands.map((b) => (
            <CheckOption
              key={b.value}
              checked={filters.brands.includes(b.value)}
              onChange={() => onToggle('brand', b.value)}
              label={b.label}
              count={b.count}
            />
          ))}
        </Group>
      )}

      {facets.specs.map((group) => (
        <Group key={group.key} title={group.label}>
          {group.options.map((o) => (
            <CheckOption
              key={o.value}
              checked={(filters.specs[group.key] ?? []).includes(o.value)}
              onChange={() => onToggle(`s_${group.key}`, o.value)}
              label={o.label}
              count={o.count}
            />
          ))}
        </Group>
      ))}
    </div>
  )
}
