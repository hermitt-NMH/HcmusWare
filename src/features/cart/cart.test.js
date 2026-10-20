import { describe, expect, it } from 'vitest'
import {
  MAX_QTY_PER_ITEM,
  addManyToCart,
  addToCart,
  cartCount,
  cartSubtotal,
  mergeFreshProducts,
  parseStoredCart,
  removeFromCart,
  setItemQty,
} from './cart'

const cpu = {
  id: 1,
  name: 'AMD Ryzen 5 7600',
  brand: 'AMD',
  price: 5490000,
  stock: 20,
  image_url: '/images/products/cpu.webp',
  categories: { slug: 'cpu' },
}
const ram = {
  id: 2,
  name: 'Kingston FURY Beast 32GB',
  price: 2690000,
  stock: 3,
  categories: { slug: 'ram' },
}
const soldOut = { id: 3, name: 'Hết hàng', price: 1000000, stock: 0, categories: { slug: 'ssd' } }

describe('addToCart', () => {
  it('thêm sản phẩm mới với slug danh mục', () => {
    const items = addToCart([], cpu)
    expect(items).toEqual([
      {
        id: 1,
        name: 'AMD Ryzen 5 7600',
        brand: 'AMD',
        price: 5490000,
        image_url: '/images/products/cpu.webp',
        slug: 'cpu',
        stock: 20,
        qty: 1,
      },
    ])
  })

  it('thêm lại sản phẩm đã có thì cộng dồn số lượng', () => {
    const items = addToCart(addToCart([], cpu, 2), cpu, 3)
    expect(items).toHaveLength(1)
    expect(items[0].qty).toBe(5)
  })

  it('không vượt tồn kho', () => {
    expect(addToCart([], ram, 5)[0].qty).toBe(3)
  })

  it(`không vượt ${MAX_QTY_PER_ITEM} sản phẩm mỗi dòng dù kho còn nhiều`, () => {
    expect(addToCart([], cpu, 50)[0].qty).toBe(MAX_QTY_PER_ITEM)
  })

  it('bỏ qua sản phẩm hết hàng', () => {
    expect(addToCart([], soldOut)).toEqual([])
  })

  it('không sửa mảng cũ (React cần state mới)', () => {
    const before = addToCart([], cpu)
    addToCart(before, cpu)
    expect(before[0].qty).toBe(1)
  })
})

describe('addManyToCart', () => {
  it('thêm cả cấu hình một lần, RAM theo số kit', () => {
    const items = addManyToCart([], [{ product: cpu }, { product: ram, qty: 2 }, { product: null }])
    expect(items.map((it) => [it.id, it.qty])).toEqual([
      [1, 1],
      [2, 2],
    ])
    expect(cartCount(items)).toBe(3)
  })
})

describe('setItemQty / removeFromCart', () => {
  const items = addManyToCart([], [{ product: cpu }, { product: ram }])

  it('đổi số lượng, giới hạn theo tồn kho', () => {
    expect(setItemQty(items, 2, 9).find((it) => it.id === 2).qty).toBe(3)
  })

  it('số lượng 0 thì xóa dòng', () => {
    expect(setItemQty(items, 1, 0).map((it) => it.id)).toEqual([2])
  })

  it('xóa dòng', () => {
    expect(removeFromCart(items, 2).map((it) => it.id)).toEqual([1])
  })
})

describe('cartSubtotal', () => {
  it('cộng giá × số lượng, bỏ dòng hết hàng hoặc đã bị xóa', () => {
    const items = [
      { id: 1, name: 'a', price: 100, stock: 5, qty: 2 },
      { id: 2, name: 'b', price: 50, stock: 0, qty: 1 },
      { id: 3, name: 'c', price: 70, stock: 5, qty: 1, missing: true },
      { id: 4, name: 'd', price: null, stock: 5, qty: 1 },
    ]
    expect(cartSubtotal(items)).toBe(200)
  })
})

describe('mergeFreshProducts', () => {
  it('cập nhật giá mới, hạ số lượng theo tồn kho mới, đánh dấu sản phẩm đã xóa', () => {
    const items = addManyToCart([], [{ product: cpu, qty: 5 }, { product: ram }])
    const merged = mergeFreshProducts(items, [{ ...cpu, price: 4990000, stock: 2 }])
    expect(merged[0]).toMatchObject({ id: 1, price: 4990000, stock: 2, qty: 2, missing: false })
    expect(merged[1]).toMatchObject({ id: 2, missing: true })
  })

  it('hết hàng thì giữ số lượng để khách thấy', () => {
    const items = addToCart([], cpu, 2)
    expect(mergeFreshProducts(items, [{ ...cpu, stock: 0 }])[0].qty).toBe(2)
  })
})

describe('parseStoredCart', () => {
  it('dữ liệu rỗng hoặc hỏng trả giỏ rỗng', () => {
    expect(parseStoredCart(null)).toEqual([])
    expect(parseStoredCart('{không phải json')).toEqual([])
    expect(parseStoredCart('{"id":1}')).toEqual([])
  })

  it('lọc bỏ dòng sai kiểu, giới hạn số lượng', () => {
    const raw = JSON.stringify([
      { id: 1, name: 'ok', qty: 2 },
      { id: '2', name: 'id là chuỗi', qty: 1 },
      { id: 3, name: 'qty âm', qty: -1 },
      { id: 4, name: 'qty quá lớn', qty: 999 },
      null,
    ])
    expect(parseStoredCart(raw).map((it) => [it.id, it.qty])).toEqual([
      [1, 2],
      [4, MAX_QTY_PER_ITEM],
    ])
  })
})
