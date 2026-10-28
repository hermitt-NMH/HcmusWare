// Form đăng ký mở shop / sửa và gửi lại (F14, US-14.1), dạng HÀM THUẦN để test.
import { toSlug } from '../../lib/slug'

export function shopToForm(shop) {
  return {
    name: shop?.name ?? '',
    description: shop?.description ?? '',
    logo_url: shop?.logo_url ?? '',
    agree: Boolean(shop), // gửi lại thì đã đồng ý quy định từ lần đầu
  }
}

// Trả { data, errors }. data gửi lên Supabase (owner_id, status do trigger trong DB tự đặt).
export function validateShopForm(form) {
  const errors = {}
  const name = form.name.trim().replace(/\s+/g, ' ')
  const description = form.description.trim()
  // Tên trùng shop khác (không phân biệt hoa thường, dấu) ↔ trùng slug → DB báo 23505.
  const slug = toSlug(name)

  if (name.length < 2 || name.length > 80) errors.name = 'Tên shop từ 2 đến 80 ký tự.'
  else if (!slug) errors.name = 'Tên shop cần có chữ hoặc số.'
  if (description.length > 2000) errors.description = 'Mô tả tối đa 2.000 ký tự.'
  if (!form.agree) errors.agree = 'Bạn cần đồng ý Quy định người bán.'

  return {
    data: { name, slug, description: description || null, logo_url: form.logo_url || null },
    errors,
  }
}

// Lỗi Supabase khi tạo / gửi lại shop → câu dễ hiểu.
export function shopErrorMessage(error) {
  if (error?.code === '23505') {
    // owner_id unique: đã có shop; slug unique: tên (bỏ dấu, không phân biệt hoa thường) đã có người dùng.
    return /owner_id/.test(error.message ?? '') || /owner_id/.test(error.details ?? '')
      ? 'Tài khoản của bạn đã có shop.'
      : 'Tên shop đã có người dùng.'
  }
  return error?.message ?? 'Lỗi không xác định.'
}

export const SHOP_STATUS = {
  pending: { label: 'Chờ admin duyệt', className: 'bg-amber-50 text-amber-800' },
  active: { label: 'Đang hoạt động', className: 'bg-green-50 text-green-800' },
  rejected: { label: 'Bị từ chối', className: 'bg-red-50 text-red-700' },
  locked: { label: 'Bị khóa', className: 'bg-red-50 text-red-700' },
}
