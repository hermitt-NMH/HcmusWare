import { describe, expect, it } from 'vitest'
import {
  amountToPay,
  canPayOnline,
  cartToOrderItems,
  groupOrdersByPayment,
  nextStatuses,
  paymentStatusLabel,
  validateCheckout,
} from './orders'

const validForm = {
  name: ' Nguyễn Văn An ',
  phone: '090 123 4567',
  address: '227 Nguyễn Văn Cừ, Phường 4, Quận 5, TP.HCM',
  note: '',
  payment: 'cod',
}

describe('validateCheckout', () => {
  it('form hợp lệ: không lỗi, dữ liệu được chuẩn hóa', () => {
    const { data, errors } = validateCheckout(validForm)
    expect(errors).toEqual({})
    expect(data.name).toBe('Nguyễn Văn An')
    expect(data.phone).toBe('0901234567')
  })

  it('thiếu họ tên, số điện thoại sai, địa chỉ quá ngắn', () => {
    const { errors } = validateCheckout({ ...validForm, name: '  ', phone: '12345', address: 'Q5' })
    expect(Object.keys(errors).sort()).toEqual(['address', 'name', 'phone'])
  })

  it('chấp nhận số +84', () => {
    expect(validateCheckout({ ...validForm, phone: '+84901234567' }).errors).toEqual({})
  })

  it('họ tên quá 100 ký tự, địa chỉ quá 300 ký tự thì báo lỗi (BUG06)', () => {
    const { errors } = validateCheckout({
      ...validForm,
      name: 'A'.repeat(101),
      address: 'x'.repeat(301),
    })
    expect(Object.keys(errors).sort()).toEqual(['address', 'name'])
  })

  it('phương thức thanh toán lạ thì báo lỗi', () => {
    expect(validateCheckout({ ...validForm, payment: 'bitcoin' }).errors.payment).toBeTruthy()
  })
})

describe('cartToOrderItems', () => {
  it('bỏ dòng hết hàng, ngừng bán, chưa có giá', () => {
    const items = [
      { id: 1, name: 'CPU', price: 100, stock: 5, qty: 2 },
      { id: 2, name: 'Hết', price: 100, stock: 0, qty: 1 },
      { id: 3, name: 'Ngừng bán', price: 100, stock: 5, qty: 1, missing: true },
      { id: 4, name: 'Liên hệ', price: null, stock: 5, qty: 1 },
    ]
    expect(cartToOrderItems(items)).toEqual([{ product_id: 1, quantity: 2 }])
  })
})

describe('nextStatuses', () => {
  it('chỉ đi tới, luôn hủy được khi chưa xong', () => {
    expect(nextStatuses('pending')).toEqual([
      'pending',
      'confirmed',
      'shipping',
      'completed',
      'cancelled',
    ])
    expect(nextStatuses('shipping')).toEqual(['shipping', 'completed', 'cancelled'])
  })

  it('đơn online chưa thanh toán chỉ giữ nguyên hoặc hủy (BUG08)', () => {
    expect(nextStatuses('pending', true)).toEqual(['pending', 'cancelled'])
  })

  it('đơn đã xong / đã hủy không đổi được', () => {
    expect(nextStatuses('completed')).toEqual(['completed'])
    expect(nextStatuses('cancelled')).toEqual(['cancelled'])
  })
})

describe('thanh toán', () => {
  const order = { payment_method: 'mock_online', paid_at: null, status: 'pending' }

  it('đơn online chưa trả, đang chờ thì thanh toán được', () => {
    expect(canPayOnline(order)).toBe(true)
    expect(canPayOnline({ ...order, paid_at: '2026-11-10T00:00:00Z' })).toBe(false)
    expect(canPayOnline({ ...order, status: 'cancelled' })).toBe(false)
    expect(canPayOnline({ ...order, payment_method: 'cod' })).toBe(false)
  })

  it('nhãn trạng thái thanh toán', () => {
    expect(paymentStatusLabel(order)).toBe('Chưa thanh toán')
    expect(paymentStatusLabel({ ...order, payment_method: 'cod' })).toBe('Trả khi nhận hàng')
    expect(paymentStatusLabel({ ...order, paid_at: 'x' })).toBe('Đã thanh toán')
    expect(paymentStatusLabel({ ...order, status: 'cancelled' })).toBe('Không thanh toán')
    expect(paymentStatusLabel({ ...order, paid_at: 'x', status: 'cancelled' })).toMatch(/hoàn tiền/)
  })
})

describe('groupOrdersByPayment', () => {
  const o = (id, code, total, extra = {}) => ({
    id,
    payment_code: code,
    total,
    created_at: `2026-12-0${id}T00:00:00Z`,
    ...extra,
  })

  it('đơn cùng mã thanh toán gom thành một lần đặt, giữ thứ tự mới nhất trước', () => {
    // getMyOrders trả mới nhất trước: 3 (TT2), 2 (TT1), 1 (TT1)
    const groups = groupOrdersByPayment([o(3, 'TT2', 500), o(2, 'TT1', 200), o(1, 'TT1', 100)])
    expect(groups.map((g) => g.code)).toEqual(['TT2', 'TT1'])
    expect(groups[1].orders.map((x) => x.id)).toEqual([1, 2])
    expect(groups[1].total).toBe(300)
  })

  it('đơn cũ không có mã thanh toán thì mỗi đơn một nhóm', () => {
    const groups = groupOrdersByPayment([o(2, null, 200), o(1, undefined, 100)])
    expect(groups.map((g) => g.code)).toEqual(['#2', '#1'])
  })

  it('danh sách rỗng', () => {
    expect(groupOrdersByPayment([])).toEqual([])
  })
})

describe('amountToPay', () => {
  const online = { payment_method: 'mock_online', paid_at: null, status: 'pending' }
  it('chỉ cộng đơn còn chờ thanh toán online, bỏ đơn shop đã hủy', () => {
    expect(
      amountToPay([
        { ...online, total: 100 },
        { ...online, total: 200, status: 'cancelled' },
        { ...online, total: 400 },
      ]),
    ).toBe(500)
  })
  it('đơn COD hoặc đã trả: không còn gì phải trả', () => {
    expect(amountToPay([{ ...online, total: 100, payment_method: 'cod' }])).toBe(0)
    expect(amountToPay([{ ...online, total: 100, paid_at: '2026-12-07' }])).toBe(0)
  })
})
