import { describe, expect, it } from 'vitest'
import { productErrorMessage, productToForm, validateProductForm } from './productForm'

const product = {
  id: 5,
  category_id: 1,
  name: 'AMD Ryzen 5 7600',
  brand: 'AMD',
  price: 5490000,
  stock: 20,
  image_url: '/images/products/cpu.webp',
  datasheet_url: null,
  description: null,
  specs: { socket: 'AM5', tdp_w: 65 },
}

describe('productToForm → validateProductForm', () => {
  it('sửa sản phẩm: dữ liệu quay về đúng như cũ', () => {
    const { data, errors } = validateProductForm(productToForm(product))
    expect(errors).toEqual({})
    expect(data).toEqual(product)
  })

  it('thêm mới: không gửi id, chuỗi rỗng thành null', () => {
    const form = { ...productToForm(null, 3), name: 'Mới', price: '1.990.000' }
    const { data, errors } = validateProductForm(form)
    expect(errors).toEqual({})
    expect(data).not.toHaveProperty('id')
    expect(data).toMatchObject({ category_id: 3, price: 1990000, stock: 0, brand: null, specs: {} })
  })
})

describe('validateProductForm báo lỗi', () => {
  const base = productToForm(product)

  it('thiếu tên, giá âm, tồn kho lẻ', () => {
    const { errors } = validateProductForm({ ...base, name: ' ', price: '-1', stock: '1.5' })
    expect(Object.keys(errors).sort()).toEqual(['name', 'price', 'stock'])
  })

  it('giá để trống', () => {
    expect(validateProductForm({ ...base, price: '' }).errors.price).toBeTruthy()
  })

  it('specs không phải JSON object', () => {
    expect(validateProductForm({ ...base, specs: '{socket: AM5}' }).errors.specs).toBeTruthy()
    expect(validateProductForm({ ...base, specs: '[1,2]' }).errors.specs).toBeTruthy()
  })

  it('link ảnh / datasheet sai', () => {
    const { errors } = validateProductForm({
      ...base,
      image_url: 'javascript:alert(1)',
      datasheet_url: 'abc',
    })
    expect(errors.image_url).toBeTruthy()
    expect(errors.datasheet_url).toBeTruthy()
  })
})

describe('productErrorMessage', () => {
  it('đổi mã lỗi Postgres thành câu dễ hiểu', () => {
    expect(productErrorMessage({ code: '23503' })).toMatch(/đơn hàng/)
    expect(productErrorMessage({ code: '23505' })).toMatch(/cùng tên/)
    expect(productErrorMessage({ message: 'x' })).toBe('x')
  })
})
