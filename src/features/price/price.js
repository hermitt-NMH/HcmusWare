// Logic lịch sử giá và cảnh báo giá dạng HÀM THUẦN để dễ viết unit test.
// Dùng ở trang sản phẩm (biểu đồ, đặt giá mong muốn), thông báo giảm giá, và
// scripts/gen-price-history.js (sinh giá giả lập 6 tháng).

const DAY_MS = 24 * 60 * 60 * 1000

// Tên sự kiện trên window: khung đặt cảnh báo bắn ra để chuông thông báo (NotificationBell) tải lại.
export const ALERTS_CHANGED = 'hcmusware:price-alerts-changed'

// Làm tròn giá tới 10.000 ₫ như giá bán lẻ thật (vd 5.490.000).
export function roundPrice(value) {
  return Math.max(10000, Math.round(value / 10000) * 10000)
}

// Bộ sinh số ngẫu nhiên có "hạt giống" (mulberry32): cùng seed → cùng dãy số.
// Nhờ vậy chạy lại script với cùng sản phẩm cho ra cùng lịch sử giá.
export function seededRandom(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Sinh lịch sử giá giả lập, mỗi tuần một điểm, kết thúc đúng bằng giá hiện tại ở thời điểm `now`.
// Đi ngược thời gian từ giá hiện tại: mỗi tuần có ~35% khả năng đổi giá ±1–6%,
// thỉnh thoảng có đợt khuyến mãi (giá thấp hơn ~8–15% trong 1–2 tuần).
// Giá luôn nằm trong khoảng 75%–130% giá hiện tại.
// Trả về [{ price, recorded_at }] theo thứ tự thời gian tăng dần (recorded_at là chuỗi ISO).
export function generatePriceSeries(currentPrice, { months = 6, seed = 1, now = new Date() } = {}) {
  const rand = seededRandom(seed)
  const weeks = Math.round((months * 30) / 7)
  const end = new Date(now).getTime()
  const min = currentPrice * 0.75
  const max = currentPrice * 1.3

  const points = [{ price: currentPrice, recorded_at: new Date(end).toISOString() }]
  let base = currentPrice // giá "thường" (không tính khuyến mãi)
  let promoWeeks = 0
  for (let w = 1; w <= weeks; w++) {
    if (rand() < 0.35) {
      const pct = 0.01 + rand() * 0.05
      base = Math.min(max, Math.max(min, base * (rand() < 0.6 ? 1 + pct : 1 - pct)))
    }
    if (promoWeeks > 0) promoWeeks--
    else if (rand() < 0.08) promoWeeks = 1 + Math.floor(rand() * 2)
    const price = promoWeeks > 0 ? base * (0.85 + rand() * 0.07) : base
    points.push({
      price: roundPrice(Math.min(max, Math.max(min, price))),
      recorded_at: new Date(end - w * 7 * DAY_MS).toISOString(),
    })
  }
  return points.reverse()
}

// Bỏ các điểm liền nhau trùng giá (chỉ giữ lần đổi giá), luôn giữ điểm cuối.
export function compactSeries(points) {
  return points.filter(
    (p, i) => i === 0 || i === points.length - 1 || p.price !== points[i - 1].price,
  )
}

// Thống kê cho biểu đồ: thấp nhất, cao nhất, giá đầu kỳ và % thay đổi so với đầu kỳ.
export function summarizeHistory(history) {
  if (!history?.length) return null
  const prices = history.map((h) => h.price)
  const first = prices[0]
  const last = prices[prices.length - 1]
  return {
    min: Math.min(...prices),
    max: Math.max(...prices),
    first,
    last,
    changePct: first ? Math.round(((last - first) / first) * 1000) / 10 : 0,
  }
}

// Thêm giá hiện tại vào cuối lịch sử nếu khác điểm cuối (vd admin vừa sửa giá mà
// trang đang mở bản cũ, hoặc sản phẩm chưa có lịch sử) để biểu đồ luôn kết thúc ở hôm nay.
export function withCurrentPrice(history, currentPrice, now = new Date()) {
  const list = history ?? []
  if (currentPrice == null) return list
  const last = list[list.length - 1]
  if (last && last.price === currentPrice) return list
  return [...list, { price: currentPrice, recorded_at: new Date(now).toISOString() }]
}

// Đọc giá khách gõ: "5.000.000", "5,000,000", "5000000 đ" → 5000000. Không hợp lệ → null.
export function parsePriceInput(text) {
  const digits = String(text ?? '').replace(/[^\d]/g, '')
  if (!digits) return null
  const n = Number(digits)
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

// Kiểm tra giá mong muốn. Trả chuỗi lỗi, hợp lệ thì ''.
export function validateTargetPrice(target, currentPrice) {
  if (target == null) return 'Vui lòng nhập giá mong muốn.'
  if (target < 10000) return 'Giá mong muốn tối thiểu 10.000 ₫.'
  if (currentPrice != null && target >= currentPrice)
    return 'Giá mong muốn phải thấp hơn giá hiện tại.'
  return ''
}
