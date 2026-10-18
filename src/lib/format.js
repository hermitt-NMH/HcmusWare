const vnd = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 })

export function formatPrice(value) {
  return vnd.format(value ?? 0)
}
