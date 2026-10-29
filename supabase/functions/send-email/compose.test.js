import { describe, expect, it } from 'vitest'
import { composeEmail, emailKind } from './compose'

const site = 'https://hcmusware.vercel.app/'
const token = '7f9c2b1e-0000-4000-8000-000000000001'

describe('emailKind', () => {
  it('chỉ giá và trạng thái đơn có email', () => {
    expect(emailKind('price_drop')).toBe('gia')
    expect(emailKind('order_status')).toBe('don')
    expect(emailKind('question_new')).toBeNull()
  })
})

describe('composeEmail (US-12.3)', () => {
  const order = {
    type: 'order_status',
    title: 'Đơn hàng #12: Đang giao',
    body: 'HcmusWare đã chuyển đơn sang "Đang giao".',
    link: '/don-hang/12',
  }

  it('tiêu đề có tên web, nội dung chữ thường có link chi tiết và link tắt email đúng loại', () => {
    const m = composeEmail(order, { siteUrl: site, token })
    expect(m.subject).toBe('HcmusWare: Đơn hàng #12: Đang giao')
    expect(m.text).toContain('Xem chi tiết: https://hcmusware.vercel.app/don-hang/12')
    expect(m.text).toContain(`https://hcmusware.vercel.app/tat-email?t=${token}&loai=don`)
    expect(m.text).toContain('email trạng thái đơn hàng')
  })

  it('cảnh báo giá dùng loại "gia"', () => {
    const m = composeEmail(
      {
        type: 'price_drop',
        title: 'Giá đã giảm',
        body: 'X chỉ còn 1.000.000 ₫',
        link: '/san-pham/5',
      },
      { siteUrl: site, token },
    )
    expect(m.text).toContain('loai=gia')
    expect(m.text).toContain('https://hcmusware.vercel.app/san-pham/5')
  })

  it('link lạ dẫn về trang chủ, không ra trang ngoài', () => {
    const m = composeEmail({ ...order, link: '//evil.example' }, { siteUrl: site, token })
    expect(m.text).toContain('Xem chi tiết: https://hcmusware.vercel.app/\n')
    expect(m.text).not.toContain('evil')
  })

  it('loại không gửi email thì báo lỗi', () => {
    expect(() =>
      composeEmail({ ...order, type: 'question_new' }, { siteUrl: site, token }),
    ).toThrow()
  })
})
