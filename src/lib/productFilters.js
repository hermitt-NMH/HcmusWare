import { SPEC_FIELDS, formatSpecValue } from './specs'

// Lọc, tìm kiếm, sắp xếp danh sách sản phẩm ngay trên trình duyệt.
// Chỉ có ~120 sản phẩm nên tải hết một lần rồi lọc tại chỗ là đủ nhanh, lại không tốn thêm truy vấn.
// Bộ lọc được lưu trên URL (?q=...&min=...&sort=...) để bấm Back hoặc gửi link vẫn giữ nguyên.

export const SORT_OPTIONS = [
  { value: 'newest', label: 'Mới nhất' },
  { value: 'price-asc', label: 'Giá thấp → cao' },
  { value: 'price-desc', label: 'Giá cao → thấp' },
  { value: 'name', label: 'Tên A → Z' },
]

// Bỏ dấu tiếng Việt và viết thường: "Bộ Nguồn" → "bo nguon", để gõ không dấu vẫn tìm được.
export function normalizeText(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
}

// Đọc bộ lọc từ URLSearchParams. Thông số dùng tiền tố "s_", vd ?s_socket=AM5&s_socket=AM4.
export function readFilters(params) {
  const toNumber = (v) => (v === null || v === '' || isNaN(Number(v)) ? null : Number(v))
  const specs = {}
  for (const [key, value] of params) {
    if (key.startsWith('s_')) (specs[key.slice(2)] ??= []).push(value)
  }
  return {
    q: params.get('q') ?? '',
    min: toNumber(params.get('min')),
    max: toNumber(params.get('max')),
    brands: params.getAll('brand'),
    inStock: params.get('stock') === '1',
    sort: params.get('sort') ?? 'newest',
    specs,
  }
}

// Giá trị thông số so sánh dạng chuỗi (giá trị trên URL luôn là chuỗi).
const asKey = (value) => String(value)

export function applyFilters(products, filters) {
  const q = normalizeText(filters.q)
  const words = q ? q.split(/\s+/) : []

  const result = products.filter((p) => {
    // Tìm theo tên + hãng: phải chứa đủ mọi từ đã gõ (không cần đúng thứ tự).
    if (words.length) {
      const haystack = normalizeText(`${p.name} ${p.brand ?? ''}`)
      if (!words.every((w) => haystack.includes(w))) return false
    }
    if (filters.min != null && p.price < filters.min) return false
    if (filters.max != null && p.price > filters.max) return false
    if (filters.brands.length && !filters.brands.includes(p.brand)) return false
    if (filters.inStock && !(p.stock > 0)) return false
    // Mỗi nhóm thông số: khớp một trong các giá trị đã tick (HOẶC); giữa các nhóm: VÀ.
    for (const [key, values] of Object.entries(filters.specs)) {
      if (values.length && !values.includes(asKey(p.specs?.[key]))) return false
    }
    return true
  })

  // Sắp xếp trên bản sao; "newest" giữ nguyên thứ tự từ API (đã sắp mới nhất trước).
  const byName = (a, b) => a.name.localeCompare(b.name, 'vi')
  if (filters.sort === 'price-asc') result.sort((a, b) => a.price - b.price || byName(a, b))
  else if (filters.sort === 'price-desc') result.sort((a, b) => b.price - a.price || byName(a, b))
  else if (filters.sort === 'name') result.sort(byName)
  return result
}

// Tạo các nhóm ô chọn cho bộ lọc từ chính dữ liệu đang có:
// danh sách hãng + các thông số có filter: true của danh mục.
// Mỗi lựa chọn kèm số sản phẩm để khách biết trước kết quả.
export function buildFacets(products, categorySlug) {
  const count = (getValue) => {
    const map = new Map()
    for (const p of products) {
      const v = getValue(p)
      if (v == null || v === '') continue
      map.set(asKey(v), { raw: v, count: (map.get(asKey(v))?.count ?? 0) + 1 })
    }
    return map
  }

  const brands = [...count((p) => p.brand)]
    .map(([value, { count }]) => ({ value, label: value, count }))
    .sort((a, b) => a.label.localeCompare(b.label))

  const specs = (SPEC_FIELDS[categorySlug] ?? [])
    .filter((f) => f.filter)
    .map((field) => {
      const options = [...count((p) => p.specs?.[field.key])]
        .map(([value, { raw, count }]) => ({
          value,
          raw,
          label: formatSpecValue(field, raw),
          count,
        }))
        // Số thì sắp tăng dần (8, 16, 32 GB), chữ thì theo bảng chữ cái.
        .sort((a, b) =>
          typeof a.raw === 'number' && typeof b.raw === 'number'
            ? a.raw - b.raw
            : a.label.localeCompare(b.label),
        )
      return { key: field.key, label: field.label, options }
    })
    // Nhóm chỉ có 1 lựa chọn thì lọc cũng vô nghĩa → ẩn.
    .filter((g) => g.options.length > 1)

  return { brands, specs }
}

// Đếm số bộ lọc đang bật (hiện trên nút "Bộ lọc" ở điện thoại).
export function countActiveFilters(filters) {
  return (
    (filters.min != null ? 1 : 0) +
    (filters.max != null ? 1 : 0) +
    filters.brands.length +
    (filters.inStock ? 1 : 0) +
    Object.values(filters.specs).reduce((sum, v) => sum + v.length, 0)
  )
}
