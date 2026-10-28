// Form thêm/sửa sản phẩm của trang admin, dạng HÀM THUẦN để test.
// Form giữ mọi ô dạng chuỗi (giống <input>), khi lưu mới đổi sang đúng kiểu của bảng products.
import { parseWholeNumber } from '../../lib/format'

// Dòng products → giá trị ban đầu của form. Không có product = thêm mới.
export function productToForm(product, defaultCategoryId = '') {
  return {
    id: product?.id ?? null,
    category_id: String(product?.category_id ?? defaultCategoryId),
    name: product?.name ?? '',
    brand: product?.brand ?? '',
    price: product?.price != null ? String(product.price) : '',
    stock: product?.stock != null ? String(product.stock) : '0',
    image_url: product?.image_url ?? '',
    datasheet_url: product?.datasheet_url ?? '',
    description: product?.description ?? '',
    specs: JSON.stringify(product?.specs ?? {}, null, 2),
  }
}

const isUrlOrPath = (v) => v.startsWith('/') || /^https?:\/\/\S+$/i.test(v)

// Kiểm tra form. Trả { data, errors }: data là dòng để gửi lên Supabase, errors rỗng là hợp lệ.
export function validateProductForm(form) {
  const errors = {}
  const name = form.name.trim()
  const price = parseWholeNumber(form.price)
  const stock = Number(form.stock)
  const imageUrl = form.image_url.trim()
  const datasheetUrl = form.datasheet_url.trim()

  if (!form.category_id) errors.category_id = 'Chọn danh mục.'
  if (!name) errors.name = 'Nhập tên sản phẩm.'
  else if (name.length > 200) errors.name = 'Tên tối đa 200 ký tự.'
  if (form.price === '' || !Number.isSafeInteger(price) || price < 0)
    errors.price = 'Giá phải là số nguyên ≥ 0 (VNĐ).'
  if (!Number.isInteger(stock) || stock < 0) errors.stock = 'Tồn kho phải là số nguyên ≥ 0.'
  if (imageUrl && !isUrlOrPath(imageUrl))
    errors.image_url = 'Ảnh phải là link http(s) hoặc đường dẫn bắt đầu bằng "/".'
  if (datasheetUrl && !/^https?:\/\/\S+$/i.test(datasheetUrl))
    errors.datasheet_url = 'Datasheet phải là link http(s).'

  let specs = {}
  try {
    specs = form.specs.trim() ? JSON.parse(form.specs) : {}
    if (!specs || typeof specs !== 'object' || Array.isArray(specs)) throw new Error()
  } catch {
    errors.specs = 'Thông số phải là JSON dạng { "khóa": giá trị }.'
  }

  const data = {
    ...(form.id ? { id: form.id } : {}),
    category_id: Number(form.category_id),
    name,
    brand: form.brand.trim() || null,
    price,
    stock,
    image_url: imageUrl || null,
    datasheet_url: datasheetUrl || null,
    description: form.description.trim() || null,
    specs,
  }
  return { data, errors }
}

// Lỗi Supabase khi lưu/xóa sản phẩm → câu dễ hiểu cho admin.
export function productErrorMessage(error) {
  if (error?.code === '23505') return 'Đã có sản phẩm cùng tên trong danh mục này.'
  if (error?.code === '23503')
    return 'Sản phẩm đã nằm trong đơn hàng nên không xóa được. Hãy đặt tồn kho = 0 để ngừng bán.'
  if (error?.code === '42501') return 'Tài khoản không có quyền quản trị.'
  return error?.message ?? 'Lỗi không xác định.'
}
