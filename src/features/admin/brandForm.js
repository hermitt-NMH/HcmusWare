// Quản lý thương hiệu của admin (US-15.6), dạng HÀM THUẦN để test.
import { toSlug } from '../../lib/slug'

// Kiểm tra tên trước khi gửi. brands: danh sách hiện có; exceptId: thương hiệu đang sửa (bỏ qua chính nó).
// Trùng = cùng slug, tức không phân biệt hoa thường và dấu ("Asus" / "ASUS" / "Ásus").
// Trả { data: { name, slug }, error } – error null là hợp lệ.
export function validateBrandName(rawName, brands = [], exceptId = null) {
  const name = String(rawName ?? '')
    .trim()
    .replace(/\s+/g, ' ')
  const slug = toSlug(name)
  let error = null
  if (name.length < 1 || name.length > 60) error = 'Tên thương hiệu từ 1 đến 60 ký tự.'
  else if (!slug) error = 'Tên thương hiệu cần có chữ hoặc số.'
  else {
    const same = brands.find((b) => b.id !== exceptId && b.slug === slug)
    if (same) error = `Thương hiệu “${same.name}” đã có.`
  }
  return { data: { name, slug }, error }
}

// Không xóa được thương hiệu còn sản phẩm (mọi trạng thái, vì products.brand_id tham chiếu tới nó).
export function deleteBlockedMessage(productCount) {
  return productCount > 0 ? `Còn ${productCount} sản phẩm thuộc thương hiệu này.` : null
}

// Lỗi Supabase → câu dễ hiểu. 23505: trùng tên/slug (người khác vừa thêm); 23503: còn sản phẩm.
export function brandErrorMessage(error) {
  if (error?.code === '23505') return 'Tên thương hiệu đã có.'
  if (error?.code === '23503') return 'Còn sản phẩm thuộc thương hiệu này nên không xóa được.'
  return error?.message ?? 'Lỗi không xác định.'
}
