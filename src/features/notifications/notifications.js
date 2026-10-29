// Chuông thông báo trên Header (F12 – US-12.1, US-12.2). Hàm thuần để viết unit test.
// Thông báo do trigger trong DB tạo (migration 20261221000000), frontend chỉ đọc và đánh dấu đã đọc.

// Số trên chuông: 0 → không hiện, lớn hơn 9 → "9+".
export function unreadBadge(count) {
  const n = Number(count) || 0
  if (n <= 0) return ''
  return n > 9 ? '9+' : String(n)
}

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

// "Vừa xong", "5 phút trước", "3 giờ trước", "2 ngày trước"; từ 7 ngày trở đi hiện ngày 09/11/2026.
export function timeAgo(iso, now = new Date()) {
  const diff = new Date(now).getTime() - new Date(iso).getTime()
  if (!(diff >= 0) || diff < MINUTE) return 'Vừa xong'
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} phút trước`
  if (diff < DAY) return `${Math.floor(diff / HOUR)} giờ trước`
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)} ngày trước`
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

// Link trong thông báo chỉ được là đường dẫn trong web ("/don-hang/12"), không mở trang ngoài
// ("//evil.com", "https://...", "javascript:..."). Không hợp lệ → null (bấm chỉ đánh dấu đã đọc).
export function safeLink(link) {
  if (typeof link !== 'string' || !link.startsWith('/') || link.startsWith('//')) return null
  if (link.includes('\\')) return null
  return link
}

// Biểu tượng theo loại thông báo (chỉ để trang trí, có aria-hidden).
const ICONS = {
  price_drop: '🏷️',
  order_status: '📦',
  order_new: '🛒',
  question_answered: '💬',
  question_new: '❓',
  shop_review: '🏪',
  product_review: '📝',
}
export function notificationIcon(type) {
  return ICONS[type] ?? '🔔'
}

// Đánh dấu đã đọc ngay trên giao diện (không chờ tải lại): ids null = tất cả.
export function markReadLocally(list, ids = null, now = new Date()) {
  const at = new Date(now).toISOString()
  return list.map((n) =>
    !n.read_at && (ids === null || ids.includes(n.id)) ? { ...n, read_at: at } : n,
  )
}
