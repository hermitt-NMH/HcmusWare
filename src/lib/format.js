// Định dạng giá kiểu Việt Nam: 12.990.000 ₫ (dấu cách thường, không dùng NBSP của Intl).
// Chưa có giá (null/undefined) thì hiện "Liên hệ" thay vì "0 ₫".
export function formatPrice(value) {
  return value == null ? 'Liên hệ' : Number(value).toLocaleString('vi-VN') + ' ₫'
}
