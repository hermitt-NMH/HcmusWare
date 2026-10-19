import { describe, expect, it } from 'vitest'
import {
  applyFilters,
  buildFacets,
  countActiveFilters,
  normalizeText,
  readFilters,
} from './productFilters'

const products = [
  {
    id: 3,
    name: 'AMD Ryzen 5 7600',
    brand: 'AMD',
    price: 5490000,
    stock: 20,
    specs: { socket: 'AM5', cores: 6, igpu: true },
  },
  {
    id: 2,
    name: 'Intel Core i5-12400',
    brand: 'Intel',
    price: 3790000,
    stock: 0,
    specs: { socket: 'LGA1700', cores: 6, igpu: true },
  },
  {
    id: 1,
    name: 'Intel Core i3-14100F',
    brand: 'Intel',
    price: 2490000,
    stock: 5,
    specs: { socket: 'LGA1700', cores: 4, igpu: false },
  },
]

const filters = (query = '') => readFilters(new URLSearchParams(query))
const ids = (list) => list.map((p) => p.id)

describe('normalizeText', () => {
  it('bỏ dấu tiếng Việt, kể cả chữ đ', () => {
    expect(normalizeText('Bộ Nguồn Đẹp')).toBe('bo nguon dep')
  })
})

describe('applyFilters', () => {
  it('không lọc gì thì giữ nguyên thứ tự', () => {
    expect(ids(applyFilters(products, filters()))).toEqual([3, 2, 1])
  })

  it('tìm theo tên, không phân biệt hoa thường, đủ mọi từ', () => {
    expect(ids(applyFilters(products, filters('q=intel i5')))).toEqual([2])
    expect(ids(applyFilters(products, filters('q=RYZEN')))).toEqual([3])
    expect(ids(applyFilters(products, filters('q=khong co')))).toEqual([])
  })

  it('lọc khoảng giá (tính cả biên)', () => {
    expect(ids(applyFilters(products, filters('min=3790000&max=5490000')))).toEqual([3, 2])
  })

  it('lọc hãng và còn hàng', () => {
    expect(ids(applyFilters(products, filters('brand=Intel&stock=1')))).toEqual([1])
  })

  it('cùng nhóm thông số là HOẶC, khác nhóm là VÀ', () => {
    expect(ids(applyFilters(products, filters('s_socket=AM5&s_socket=LGA1700')))).toEqual([3, 2, 1])
    expect(ids(applyFilters(products, filters('s_socket=LGA1700&s_cores=6')))).toEqual([2])
    expect(ids(applyFilters(products, filters('s_igpu=false')))).toEqual([1])
  })

  it('sắp xếp theo giá và tên, không làm đổi mảng gốc', () => {
    expect(ids(applyFilters(products, filters('sort=price-asc')))).toEqual([1, 2, 3])
    expect(ids(applyFilters(products, filters('sort=price-desc')))).toEqual([3, 2, 1])
    expect(ids(applyFilters(products, filters('sort=name')))).toEqual([3, 1, 2])
    expect(ids(products)).toEqual([3, 2, 1])
  })

  it('giá trên URL không phải số thì bỏ qua', () => {
    expect(filters('min=abc').min).toBeNull()
  })
})

describe('buildFacets', () => {
  it('đếm hãng và thông số, sắp số tăng dần', () => {
    const facets = buildFacets(products, 'cpu')
    expect(facets.brands).toEqual([
      { value: 'AMD', label: 'AMD', count: 1 },
      { value: 'Intel', label: 'Intel', count: 2 },
    ])
    const cores = facets.specs.find((g) => g.key === 'cores')
    expect(cores.options.map((o) => [o.value, o.count])).toEqual([
      ['4', 1],
      ['6', 2],
    ])
    const igpu = facets.specs.find((g) => g.key === 'igpu')
    expect(igpu.options.map((o) => o.label).sort()).toEqual(['Có', 'Không'])
  })

  it('trang tất cả sản phẩm (không có danh mục) chỉ có lọc hãng', () => {
    expect(buildFacets(products, undefined).specs).toEqual([])
  })
})

describe('countActiveFilters', () => {
  it('đếm giá, hãng, còn hàng và thông số; tìm kiếm và sắp xếp không tính', () => {
    expect(
      countActiveFilters(
        filters('q=a&sort=name&min=1&brand=AMD&stock=1&s_socket=AM5&s_socket=AM4'),
      ),
    ).toBe(5)
  })
})
