import { describe, expect, it } from 'vitest'
import {
  canPayOnline,
  cartToOrderItems,
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
