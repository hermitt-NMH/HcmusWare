import { describe, expect, it } from 'vitest'
import {
  OTHER_BRAND,
  changedFields,
  checkImageFile,
  needsReview,
  sellerActions,
  sellerProductToForm,
  validateSellerProduct,
} from './sellerProduct'

const categories = [{ id: 1, slug: 'cpu' }]
const product = {
  id: 9,
  category_id: 1,
  name: 'AMD Ryzen 5 7600',
  brand_id: 3,
  brand: 'AMD',
  price: 5490000,
  stock: 20,
  image_url: 'https://x.supabase.co/a.webp',
  images: ['https://x.supabase.co/a.webp'],
  datasheet_url: null,
  description: null,
  specs: {
    socket: 'AM5',
    cores: 6,
    base_clock_ghz: 3.8,
    boost_clock_ghz: 5.1,
    tdp_w: 65,
    igpu: true,
  },
}

describe('sellerProductToForm → validateSellerProduct', () => {
  it('sửa sản phẩm: không đổi gì thì không có cột nào thay đổi', () => {
    const { data, errors } = validateSellerProduct(sellerProductToForm(product, categories), 'cpu')
    expect(errors).toEqual({})
    expect(changedFields(product, data, true)).toEqual({})
  })

  it('form trống báo lỗi đủ các ô bắt buộc, lỗi thông số có tiền tố specs.', () => {
    const { errors } = validateSellerProduct(sellerProductToForm(null), 'cpu')
    expect(Object.keys(errors)).toEqual(
      expect.arrayContaining([
        'category_id',
        'name',
        'brand_id',
        'price',
        'stock',
        'images',
        'specs.socket',
      ]),
    )
  })

  it('giá ngoài 1.000 – 200.000.000, tồn kho > 9.999 → lỗi; "1.990.000" đọc được', () => {
    const form = sellerProductToForm(product, categories)
    expect(validateSellerProduct({ ...form, price: '500' }, 'cpu').errors.price).toBeDefined()
    expect(validateSellerProduct({ ...form, price: '300000000' }, 'cpu').errors.price).toBeDefined()
    expect(validateSellerProduct({ ...form, stock: '10000' }, 'cpu').errors.stock).toBeDefined()
    expect(validateSellerProduct({ ...form, price: '1.990.000' }, 'cpu').data.price).toBe(1990000)
  })

  it('tên dưới 5 ký tự, quá 5 ảnh, datasheet http → lỗi', () => {
    const form = sellerProductToForm(product, categories)
    const { errors } = validateSellerProduct(
      { ...form, name: 'CPU', images: Array(6).fill('a'), datasheet_url: 'http://a.com' },
      'cpu',
    )
    expect(Object.keys(errors).sort()).toEqual(['datasheet_url', 'images', 'name'])
  })

  it('"Thương hiệu khác": brand_id trống, tên lưu ở brand; bắt buộc gõ tên', () => {
    const form = { ...sellerProductToForm(product, categories), brand_id: OTHER_BRAND }
    expect(validateSellerProduct(form, 'cpu').errors.other_brand).toBeDefined()
    const { data } = validateSellerProduct({ ...form, other_brand: ' Hãng Mới ' }, 'cpu')
    expect(data).toMatchObject({ brand_id: null, brand: 'Hãng Mới' })
  })

  it('sản phẩm cũ chưa có thương hiệu trong danh sách mở ra ở "Thương hiệu khác"', () => {
    const form = sellerProductToForm({ ...product, brand_id: null, brand: 'Lạ' }, categories)
    expect(form).toMatchObject({ brand_id: OTHER_BRAND, other_brand: 'Lạ' })
  })
})

describe('changedFields / needsReview (C3)', () => {
  const base = () => validateSellerProduct(sellerProductToForm(product, categories), 'cpu').data

  it('đổi giá, tồn kho, ảnh → không phải duyệt lại', () => {
    const changes = changedFields(product, { ...base(), price: 5290000, images: ['b', 'a'] }, true)
    expect(Object.keys(changes)).toEqual(['price', 'images'])
    expect(needsReview(changes)).toBe(false)
  })

  it('đổi thông số → phải duyệt lại; chưa chạm ô thông số thì không gửi specs', () => {
    const data = { ...base(), specs: { ...product.specs, tdp_w: 105 } }
    expect(needsReview(changedFields(product, data, true))).toBe(true)
    // Thông số cũ có khóa lạ (không có trên form): người bán chỉ sửa giá → không gửi specs.
    const odd = { ...product, specs: { ...product.specs, chipset: 'B650' } }
    expect(changedFields(odd, { ...base(), price: 1 }, false)).toEqual({ price: 1 })
  })

  it('đổi tên → phải duyệt lại', () => {
    expect(
      needsReview(changedFields(product, { ...base(), name: 'AMD Ryzen 5 7600X' }, true)),
    ).toBe(true)
  })
})

describe('checkImageFile', () => {
  it('JPG ≤ 2 MB hợp lệ; quá 2 MB hoặc không phải ảnh → lỗi', () => {
    expect(checkImageFile({ name: 'a.jpg', type: 'image/jpeg', size: 2 * 1024 * 1024 })).toBeNull()
    expect(checkImageFile({ name: 'b.png', type: 'image/png', size: 2 * 1024 * 1024 + 1 })).toMatch(
      /lớn hơn 2 MB/,
    )
    expect(checkImageFile({ name: 'c.gif', type: 'image/gif', size: 10 })).toMatch(/JPG, PNG/)
  })
})

describe('sellerActions', () => {
  it('đang bán → ẩn; đã ẩn còn duyệt → hiện lại; bị trả lại / bị gỡ → gửi duyệt lại; chờ duyệt → không có', () => {
    expect(sellerActions({ status: 'active', approved_at: 'x' })).toEqual(['hide'])
    expect(sellerActions({ status: 'hidden', approved_at: 'x' })).toEqual(['show'])
    expect(sellerActions({ status: 'hidden', approved_at: null })).toEqual(['resubmit'])
    expect(sellerActions({ status: 'pending', approved_at: null })).toEqual([])
  })
})
