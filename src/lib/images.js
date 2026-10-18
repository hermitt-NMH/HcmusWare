// Ảnh minh họa theo danh mục (public/images/categories/<slug>.svg),
// dùng khi sản phẩm chưa có image_url hoặc ảnh gốc lỗi.
const CATEGORY_SLUGS = ['cpu', 'mainboard', 'ram', 'vga', 'ssd', 'psu', 'case', 'cooler']

// Nền nhạt riêng cho từng danh mục để lưới sản phẩm bớt đơn điệu.
const CATEGORY_BG = {
  cpu: 'from-sky-50 to-blue-100',
  mainboard: 'from-slate-50 to-slate-200',
  ram: 'from-fuchsia-50 to-violet-100',
  vga: 'from-rose-50 to-red-100',
  ssd: 'from-cyan-50 to-teal-100',
  psu: 'from-amber-50 to-yellow-100',
  case: 'from-indigo-50 to-indigo-100',
  cooler: 'from-orange-50 to-amber-100',
}

export function categoryImage(slug) {
  return CATEGORY_SLUGS.includes(slug) ? `/images/categories/${slug}.svg` : '/logo.svg'
}

export function categoryBg(slug) {
  return CATEGORY_BG[slug] ?? 'from-slate-50 to-slate-100'
}
