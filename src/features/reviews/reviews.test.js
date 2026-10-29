import { describe, expect, it } from 'vitest'
import {
  canAnswerAsSeller,
  cleanText,
  formatRating,
  groupThreads,
  textLength,
  ugcErrorMessage,
  validateComment,
  validateReview,
} from './reviews'

describe('cleanText (US-16.5)', () => {
  it('gộp nhiều dòng trống còn 1 dòng trống, giữ xuống dòng đơn', () => {
    expect(cleanText('a\n\n\n\nb')).toBe('a\n\nb')
    expect(cleanText('a\r\n\r\n\r\nb\nc')).toBe('a\n\nb\nc')
    expect(cleanText('a\n   \n \t \nb')).toBe('a\n\nb')
  })

  it('bỏ khoảng trắng 2 đầu; null/undefined → chuỗi rỗng', () => {
    expect(cleanText('  \n xin chào \n ')).toBe('xin chào')
    expect(cleanText(null)).toBe('')
    expect(cleanText(undefined)).toBe('')
  })

  it('giữ nguyên HTML dạng chữ (React tự thoát khi hiện)', () => {
    const html = '<script>alert(1)</script> <img src=x onerror=alert(1)>'
    expect(cleanText(html)).toBe(html)
  })
})

describe('formatRating', () => {
  it('1 chữ số thập phân, dấu phẩy kiểu Việt Nam, kèm số lượt', () => {
    expect(formatRating(4.6, 12)).toBe('4,6 ★ (12)')
    expect(formatRating('5.0', 1)).toBe('5,0 ★ (1)')
    expect(formatRating(3, 2)).toBe('3,0 ★ (2)')
  })

  it('chưa có lượt nào → null', () => {
    expect(formatRating(null, 0)).toBeNull()
    expect(formatRating(undefined, undefined)).toBeNull()
  })
})

describe('validateReview (US-16.1)', () => {
  it('số sao bắt buộc 1–5', () => {
    expect(validateReview({ rating: 0, comment: '' }).errors.rating).toBeDefined()
    expect(validateReview({ rating: 6, comment: '' }).errors.rating).toBeDefined()
    expect(validateReview({ rating: 2.5, comment: '' }).errors.rating).toBeDefined()
    expect(validateReview({ rating: '4', comment: '' }).errors).toEqual({})
  })

  it('nhận xét không bắt buộc: trống → null; quá 1000 ký tự → lỗi', () => {
    expect(validateReview({ rating: 5, comment: '   ' }).data).toEqual({ rating: 5, comment: null })
    expect(validateReview({ rating: 5, comment: 'a'.repeat(1000) }).errors).toEqual({})
    expect(validateReview({ rating: 5, comment: 'a'.repeat(1001) }).errors.comment).toBeDefined()
  })

  it('đếm emoji là 1 ký tự như PostgreSQL', () => {
    expect(textLength('👍👍')).toBe(2)
    expect(validateReview({ rating: 5, comment: '👍'.repeat(1000) }).errors).toEqual({})
  })
})

describe('validateComment (US-16.2)', () => {
  it('chỉ khoảng trắng → lỗi; 1–1000 ký tự → đạt', () => {
    expect(validateComment(' \n\t ').error).toBeTruthy()
    expect(validateComment('a').error).toBeNull()
    expect(validateComment(` ${'a'.repeat(1000)} `).error).toBeNull()
    expect(validateComment('a'.repeat(1001)).error).toBeTruthy()
  })

  it('trả nội dung đã làm sạch', () => {
    expect(validateComment('  Còn hàng không?\n\n\n\nShop ơi  ').data).toBe(
      'Còn hàng không?\n\nShop ơi',
    )
  })
})

describe('groupThreads', () => {
  const c = (id, parent_id, created_at) => ({ id, parent_id, created_at })

  it('câu hỏi mới nhất trước, câu trả lời cũ → mới', () => {
    const threads = groupThreads([
      c(1, null, '2026-12-14T08:00:00Z'),
      c(2, null, '2026-12-15T08:00:00Z'),
      c(4, 1, '2026-12-16T08:00:00Z'),
      c(3, 1, '2026-12-14T09:00:00Z'),
    ])
    expect(threads.map((q) => q.id)).toEqual([2, 1])
    expect(threads[1].replies.map((r) => r.id)).toEqual([3, 4])
    expect(threads[0].replies).toEqual([])
  })

  it('cùng thời điểm thì xếp theo id; trả lời của câu hỏi không có trong danh sách thì bỏ', () => {
    const t = '2026-12-14T08:00:00Z'
    const threads = groupThreads([c(5, null, t), c(6, null, t), c(7, 99, t)])
    expect(threads.map((q) => q.id)).toEqual([6, 5])
    expect(threads.flatMap((q) => q.replies)).toEqual([])
  })
})

describe('ugcErrorMessage', () => {
  it('giữ câu báo lỗi tiếng Việt từ DB; thiếu quyền → câu chung', () => {
    expect(ugcErrorMessage({ message: 'Chỉ người đã nhận hàng mới đánh giá được' })).toBe(
      'Chỉ người đã nhận hàng mới đánh giá được',
    )
    expect(ugcErrorMessage({ code: '42501', message: 'permission denied' })).toMatch(
      /không có quyền/,
    )
    expect(ugcErrorMessage(null)).toBe('Lỗi không xác định.')
  })
})

describe('canAnswerAsSeller (US-16.3)', () => {
  const myShop = { slug: 'linh-kien-sg', status: 'active' }

  it('người bán chỉ trả lời có nhãn trên sản phẩm shop mình đang hoạt động', () => {
    expect(canAnswerAsSeller({ role: 'seller', myShop, productShopSlug: 'linh-kien-sg' })).toBe(
      true,
    )
    expect(canAnswerAsSeller({ role: 'seller', myShop, productShopSlug: 'hcmusware' })).toBe(false)
    const locked = { ...myShop, status: 'locked' }
    expect(
      canAnswerAsSeller({ role: 'seller', myShop: locked, productShopSlug: 'linh-kien-sg' }),
    ).toBe(false)
  })

  it('admin trả lời thay shop HcmusWare; khách thì không', () => {
    expect(canAnswerAsSeller({ role: 'admin', productShopSlug: 'hcmusware' })).toBe(true)
    expect(canAnswerAsSeller({ role: 'admin', productShopSlug: 'linh-kien-sg' })).toBe(false)
    expect(canAnswerAsSeller({ role: 'customer', myShop, productShopSlug: 'linh-kien-sg' })).toBe(
      false,
    )
    expect(canAnswerAsSeller({ role: 'seller', myShop: null, productShopSlug: 'x' })).toBe(false)
  })
})
