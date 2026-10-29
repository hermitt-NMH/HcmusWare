// Tải file đơn vị hành chính (public/data, ~27 KB gzip) một lần khi mở form địa chỉ;
// các lần sau dùng lại kết quả trong bộ nhớ → gợi ý không cần chờ mạng.
let cached = null

export function loadAdminUnits() {
  if (!cached) {
    cached = fetch('/data/don-vi-hanh-chinh.json')
      .then((res) => {
        if (!res.ok) throw new Error(`Không tải được danh sách Tỉnh/Thành (${res.status})`)
        return res.json()
      })
      .catch((err) => {
        cached = null // lỗi mạng: lần mở form sau thử lại
        throw err
      })
  }
  return cached
}
