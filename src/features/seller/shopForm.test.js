import { describe, expect, it } from 'vitest'
import { shopErrorMessage, shopToForm, validateShopForm } from './shopForm'
import { toSlug } from '../../lib/slug'

describe('toSlug', () => {
  it('bỏ dấu, viết thường, nối bằng gạch ngang', () => {
    expect(toSlug('Linh Kiện Sài Gòn')).toBe('linh-kien-sai-gon')
    expect(toSlug('  Đồ  Chơi PC!! ')).toBe('do-choi-pc')
    expect(toSlug('be quiet!')).toBe('be-quiet')
    expect(toSlug('!!!')).toBe('')
  })
})

describe('validateShopForm', () => {
  const ok = { ...shopToForm(null), name: 'Linh Kiện Sài Gòn', agree: true }

  it('hợp lệ: gom khoảng trắng thừa, mô tả trống → null', () => {
    const { data, errors } = validateShopForm({ ...ok, name: ' Linh  Kiện Sài Gòn ' })
    expect(errors).toEqual({})
    expect(data).toEqual({
      name: 'Linh Kiện Sài Gòn',
      slug: 'linh-kien-sai-gon',
      description: null,
      logo_url: null,
    })
  })

  it('tên 1 ký tự / quá 80 ký tự / chỉ có ký hiệu → lỗi', () => {
    expect(validateShopForm({ ...ok, name: 'A' }).errors.name).toBeDefined()
    expect(validateShopForm({ ...ok, name: 'A'.repeat(81) }).errors.name).toBeDefined()
    expect(validateShopForm({ ...ok, name: '***' }).errors.name).toMatch(/chữ hoặc số/)
  })

  it('chưa đồng ý quy định, mô tả quá 2000 ký tự → lỗi', () => {
    const { errors } = validateShopForm({ ...ok, agree: false, description: 'x'.repeat(2001) })
    expect(Object.keys(errors).sort()).toEqual(['agree', 'description'])
  })
})

describe('shopErrorMessage', () => {
  it('trùng tên (slug) và đã có shop (owner_id) báo khác nhau', () => {
    expect(shopErrorMessage({ code: '23505', message: 'duplicate key "shops_slug_key"' })).toBe(
      'Tên shop đã có người dùng.',
    )
    expect(shopErrorMessage({ code: '23505', message: 'duplicate key "shops_owner_id_key"' })).toBe(
      'Tài khoản của bạn đã có shop.',
    )
  })
})
