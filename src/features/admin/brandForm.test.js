import { describe, it, expect } from 'vitest'
import { brandErrorMessage, deleteBlockedMessage, validateBrandName } from './brandForm'

const brands = [
  { id: 1, name: 'ASUS', slug: 'asus' },
  { id: 2, name: 'be quiet!', slug: 'be-quiet' },
]

describe('validateBrandName – thêm / sửa thương hiệu', () => {
  it('tên hợp lệ → tạo slug, gộp khoảng trắng', () => {
    expect(validateBrandName('  Cooler   Master ', brands)).toEqual({
      data: { name: 'Cooler Master', slug: 'cooler-master' },
      error: null,
    })
  })

  it('trùng không phân biệt hoa thường, dấu → lỗi', () => {
    expect(validateBrandName('asus', brands).error).toBe('Thương hiệu “ASUS” đã có.')
    expect(validateBrandName('Ásus', brands).error).toBeTruthy()
    expect(validateBrandName('Be Quiet', brands).error).toBeTruthy()
  })

  it('sửa chính nó (đổi hoa thường) → hợp lệ', () => {
    expect(validateBrandName('Asus', brands, 1).error).toBeNull()
  })

  it('rỗng, quá 60 ký tự, chỉ ký hiệu → lỗi', () => {
    expect(validateBrandName('   ', brands).error).toBeTruthy()
    expect(validateBrandName('a'.repeat(61), brands).error).toBeTruthy()
    expect(validateBrandName('!!!', brands).error).toBeTruthy()
  })
})

describe('xóa thương hiệu', () => {
  it('còn sản phẩm → báo số lượng; không còn → cho xóa', () => {
    expect(deleteBlockedMessage(3)).toBe('Còn 3 sản phẩm thuộc thương hiệu này.')
    expect(deleteBlockedMessage(0)).toBeNull()
  })

  it('lỗi DB → câu dễ hiểu', () => {
    expect(brandErrorMessage({ code: '23505' })).toBe('Tên thương hiệu đã có.')
    expect(brandErrorMessage({ code: '23503' })).toMatch(/không xóa được/)
  })
})
