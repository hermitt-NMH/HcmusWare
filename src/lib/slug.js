import { normalizeText } from './productFilters'

// Đường dẫn thân thiện từ tên, bỏ dấu: "Linh Kiện Sài Gòn" → "linh-kien-sai-gon", "be quiet!" → "be-quiet".
// Khớp ràng buộc slug của bảng shops / brands: ^[a-z0-9]+(-[a-z0-9]+)*$
export function toSlug(text) {
  return normalizeText(text)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
