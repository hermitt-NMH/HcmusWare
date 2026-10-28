// Form thêm/sửa sản phẩm của kênh người bán (F14), dạng HÀM THUẦN để test.
// Trường chung theo docs/thong-so-bat-buoc.md; thông số theo danh mục ở specFields.js.
import { specsToForm, validateSpecs } from './specFields'
import { parseWholeNumber } from '../../lib/format'

export const MAX_IMAGES = 5
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
// Giá trị của ô chọn thương hiệu khi thương hiệu chưa có trong danh sách (C1).
export const OTHER_BRAND = 'other'

// Kiểm tra một file ảnh trước khi tải lên. Hợp lệ → null, sai → câu báo lỗi.
export function checkImageFile(file) {
  if (!IMAGE_TYPES.includes(file.type)) return `Ảnh "${file.name}" phải là JPG, PNG hoặc WebP.`
  if (file.size > MAX_IMAGE_BYTES) return `Ảnh "${file.name}" lớn hơn 2 MB.`
  return null
}

// Dòng products → giá trị ban đầu của form. categories: [{ id, slug }] để biết danh mục của sản phẩm.
export function sellerProductToForm(product, categories = []) {
  const slug = categories.find((c) => c.id === product?.category_id)?.slug
  return {
    category_id: product?.category_id != null ? String(product.category_id) : '',
    name: product?.name ?? '',
    brand_id: product ? (product.brand_id != null ? String(product.brand_id) : OTHER_BRAND) : '',
    other_brand: product?.brand_id == null ? (product?.brand ?? '') : '',
    price: product?.price != null ? String(product.price) : '',
    stock: product?.stock != null ? String(product.stock) : '',
    images: product?.images?.length
      ? product.images
      : product?.image_url
        ? [product.image_url]
        : [],
    description: product?.description ?? '',
    datasheet_url: product?.datasheet_url ?? '',
    specs: specsToForm(slug, product?.specs),
  }
}

// Kiểm tra cả form. categorySlug: slug của danh mục đang chọn (để kiểm tra thông số).
// Trả { data, errors, warnings }: data là dòng gửi lên Supabase (chưa có shop_id),
// errors có khóa "specs.<khóa>" cho lỗi thông số để form báo đúng ô.
export function validateSellerProduct(form, categorySlug) {
  const errors = {}
  const name = form.name.trim()
  const price = parseWholeNumber(form.price)
  const stock = parseWholeNumber(form.stock)
  const otherBrand = form.other_brand.trim()
  const description = form.description.trim()
  const datasheet = form.datasheet_url.trim()

  if (!form.category_id) errors.category_id = 'Chọn danh mục.'
  if (name.length < 5 || name.length > 200) errors.name = 'Tên sản phẩm từ 5 đến 200 ký tự.'
  if (!form.brand_id) errors.brand_id = 'Chọn thương hiệu.'
  else if (form.brand_id === OTHER_BRAND && (otherBrand.length < 1 || otherBrand.length > 60))
    errors.other_brand = 'Nhập tên thương hiệu (tối đa 60 ký tự).'
  if (
    String(form.price).trim() === '' ||
    !Number.isInteger(price) ||
    price < 1000 ||
    price > 200_000_000
  )
    errors.price = 'Giá là số nguyên từ 1.000 đến 200.000.000 ₫.'
  if (String(form.stock).trim() === '' || !Number.isInteger(stock) || stock < 0 || stock > 9999)
    errors.stock = 'Tồn kho là số nguyên từ 0 đến 9.999.'
  if (!form.images.length) errors.images = 'Cần ít nhất 1 ảnh.'
  else if (form.images.length > MAX_IMAGES) errors.images = `Tối đa ${MAX_IMAGES} ảnh.`
  if (description.length > 5000) errors.description = 'Mô tả tối đa 5.000 ký tự.'
  if (datasheet && !/^https:\/\/\S+$/i.test(datasheet))
    errors.datasheet_url = 'Link datasheet phải bắt đầu bằng https://'

  const spec = validateSpecs(categorySlug, form.specs)
  for (const [key, message] of Object.entries(spec.errors)) errors[`specs.${key}`] = message

  const isOther = form.brand_id === OTHER_BRAND
  const data = {
    category_id: Number(form.category_id),
    name,
    // "Thương hiệu khác": brand_id trống, tên lưu ở brand; admin tạo thương hiệu khi duyệt (C1).
    // Chọn từ danh sách: chỉ gửi brand_id, trigger sync_product_brand chép tên sang brand.
    brand_id: isOther ? null : Number(form.brand_id),
    ...(isOther ? { brand: otherBrand } : {}),
    price,
    stock,
    images: form.images,
    description: description || null,
    datasheet_url: datasheet || null,
    specs: spec.specs,
  }
  return { data, errors, warnings: spec.warnings }
}

// So sánh 2 giá trị JSON không phụ thuộc thứ tự khóa ({a,b} = {b,a}).
function sameJson(a, b) {
  if (a === b) return true
  if (a == null || b == null) return a == null && b == null // null và undefined coi như nhau
  if (typeof a !== 'object' || typeof b !== 'object') return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  return [...keys].every((k) => sameJson(a[k], b[k]))
}

// Khi sửa: chỉ gửi các cột thật sự đổi, để thông số cũ có khóa lạ (không có trên form)
// không bị coi là "đổi thông số" khi người bán chỉ sửa giá.
export function changedFields(original, data, specsTouched) {
  const changes = {}
  for (const [key, value] of Object.entries(data)) {
    if (key === 'specs' && !specsTouched) continue
    if (!sameJson(original[key], value)) changes[key] = value
  }
  return changes
}

// Đổi tên / danh mục / thương hiệu / thông số → sản phẩm về chờ duyệt (C3, trigger guard_product_write).
export const REVIEW_FIELDS = ['name', 'category_id', 'brand_id', 'brand', 'specs']
export function needsReview(changes) {
  return REVIEW_FIELDS.some((key) => key in changes)
}

// Trạng thái sản phẩm → nhãn cho người bán / admin.
export const PRODUCT_STATUS = {
  pending: { label: 'Chờ duyệt', className: 'bg-amber-50 text-amber-800' },
  active: { label: 'Đang bán', className: 'bg-green-50 text-green-800' },
  hidden: { label: 'Đã ẩn', className: 'bg-slate-100 text-slate-600' },
}

// Người bán bấm được nút nào với sản phẩm (UI chỉ để tiện; trigger trong DB mới là chốt chặn).
// - Ẩn: sản phẩm đang bán
// - Hiện lại: đã ẩn, đã từng được duyệt và chưa bị admin gỡ (approved_at còn)
// - Gửi duyệt lại: đã ẩn mà chưa được duyệt (bị trả lại hoặc bị gỡ)
export function sellerActions(product) {
  if (product.status === 'active') return ['hide']
  if (product.status === 'hidden') return product.approved_at ? ['show'] : ['resubmit']
  return []
}
