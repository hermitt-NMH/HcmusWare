import { describe, expect, it } from 'vitest'
import { productSrcSet, thumbUrl } from './images'

describe('thumbUrl', () => {
  it('đổi ảnh sản phẩm trong web sang bản -sm', () => {
    expect(thumbUrl('/images/products/cpu-amd-ryzen-5-7600.webp')).toBe(
      '/images/products/cpu-amd-ryzen-5-7600-sm.webp',
    )
  })

  it('giữ nguyên link ngoài, ảnh danh mục, ảnh đã là -sm và giá trị rỗng', () => {
    expect(thumbUrl('https://cdn.example.com/a.webp')).toBe('https://cdn.example.com/a.webp')
    expect(thumbUrl('/images/categories/cpu.svg')).toBe('/images/categories/cpu.svg')
    expect(thumbUrl('/images/products/a-sm.webp')).toBe('/images/products/a-sm.webp')
    expect(thumbUrl(null)).toBe(null)
  })
})

describe('productSrcSet', () => {
  it('có cả bản 400w và 600w', () => {
    expect(productSrcSet('/images/products/a.webp')).toBe(
      '/images/products/a-sm.webp 400w, /images/products/a.webp 600w',
    )
  })

  it('không có bản thu nhỏ thì bỏ srcSet', () => {
    expect(productSrcSet('https://cdn.example.com/a.jpg')).toBeUndefined()
    expect(productSrcSet(null)).toBeUndefined()
  })
})
