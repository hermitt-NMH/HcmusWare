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

// Ảnh thu nhỏ 400px do `npm run thumbs` tạo cạnh ảnh gốc 600px (chỉ có cho ảnh trong
// public/images/products/; link ngoài admin nhập thì giữ nguyên).
const LOCAL_PRODUCT_IMG = /^\/images\/products\/.+(?<!-sm)\.webp$/

export function thumbUrl(url) {
  return url && LOCAL_PRODUCT_IMG.test(url) ? url.replace(/\.webp$/, '-sm.webp') : url
}

// srcSet cho ảnh hiển thị to nhỏ tùy màn hình (thẻ sản phẩm); undefined nếu không có bản thu nhỏ.
export function productSrcSet(url) {
  const thumb = thumbUrl(url)
  return thumb && thumb !== url ? `${thumb} 400w, ${url} 600w` : undefined
}

export function categoryBg(slug) {
  return CATEGORY_BG[slug] ?? 'from-slate-50 to-slate-100'
}
