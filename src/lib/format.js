// Định dạng giá kiểu Việt Nam: 12.990.000 ₫ (dấu cách thường, không dùng NBSP của Intl).
// Chưa có giá (null/undefined) thì hiện "Liên hệ" thay vì "0 ₫".
export function formatPrice(value) {
  return value == null ? 'Liên hệ' : Number(value).toLocaleString('vi-VN') + ' ₫'
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
