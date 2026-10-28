// Định dạng giá kiểu Việt Nam: 12.990.000 ₫ (dấu cách thường, không dùng NBSP của Intl).
// Chưa có giá (null/undefined) thì hiện "Liên hệ" thay vì "0 ₫".
export function formatPrice(value) {
  return value == null ? 'Liên hệ' : Number(value).toLocaleString('vi-VN') + ' ₫'
}

// Đọc số nguyên người dùng gõ (giá, tồn kho): "1290000", "1.290.000", "1,290,000", "1 290 000".
// Dấu phân cách hàng nghìn phải đúng nhóm 3 chữ số và cùng một loại; còn lại (vd "1500.5",
// "1290000.00") trả NaN để form báo lỗi – trước đây xóa hết dấu nên "1290000.00" thành 129.000.000 (BUG-G2T2-01).
export function parseWholeNumber(text) {
  const s = String(text ?? '').trim()
  if (/^\d+$/.test(s)) return Number(s)
  if (/^\d{1,3}([., ])\d{3}(\1\d{3})*$/.test(s)) return Number(s.replace(/[., ]/g, ''))
  return NaN
}

// Ngày giờ kiểu Việt Nam: 09/11/2026 14:30.
export function formatDateTime(iso) {
  return new Date(iso).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

// Chỉ ngày: 09/11/2026.
export function formatDate(iso) {
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}
