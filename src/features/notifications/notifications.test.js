import { describe, expect, it } from 'vitest'
import { markReadLocally, notificationIcon, safeLink, timeAgo, unreadBadge } from './notifications'

describe('unreadBadge (US-12.1)', () => {
  it('0 hoặc không có số → không hiện', () => {
    expect(unreadBadge(0)).toBe('')
    expect(unreadBadge(null)).toBe('')
    expect(unreadBadge(undefined)).toBe('')
    expect(unreadBadge(-1)).toBe('')
  })

  it('1–9 hiện đúng số, lớn hơn 9 hiện "9+"', () => {
    expect(unreadBadge(1)).toBe('1')
    expect(unreadBadge(9)).toBe('9')
    expect(unreadBadge(10)).toBe('9+')
    expect(unreadBadge(250)).toBe('9+')
  })
})

describe('timeAgo', () => {
  const now = new Date('2026-12-21T10:00:00Z')
  const ago = (ms) => new Date(now.getTime() - ms).toISOString()

  it('dưới 1 phút, hoặc giờ máy lệch về sau → "Vừa xong"', () => {
    expect(timeAgo(ago(0), now)).toBe('Vừa xong')
    expect(timeAgo(ago(59 * 1000), now)).toBe('Vừa xong')
    expect(timeAgo(ago(-5 * 60 * 1000), now)).toBe('Vừa xong')
    expect(timeAgo('không phải ngày', now)).toBe('Vừa xong')
  })

  it('phút, giờ, ngày', () => {
    expect(timeAgo(ago(60 * 1000), now)).toBe('1 phút trước')
    expect(timeAgo(ago(59 * 60 * 1000), now)).toBe('59 phút trước')
    expect(timeAgo(ago(60 * 60 * 1000), now)).toBe('1 giờ trước')
    expect(timeAgo(ago(23 * 60 * 60 * 1000), now)).toBe('23 giờ trước')
    expect(timeAgo(ago(24 * 60 * 60 * 1000), now)).toBe('1 ngày trước')
    expect(timeAgo(ago(6 * 24 * 60 * 60 * 1000), now)).toBe('6 ngày trước')
  })

  it('từ 7 ngày hiện ngày dd/mm/yyyy', () => {
    expect(timeAgo('2026-12-01T03:00:00Z', now)).toBe('01/12/2026')
  })
})

describe('safeLink', () => {
  it('giữ đường dẫn trong web', () => {
    expect(safeLink('/don-hang/12')).toBe('/don-hang/12')
    expect(safeLink('/kenh-nguoi-ban/san-pham/5')).toBe('/kenh-nguoi-ban/san-pham/5')
  })

  it('chặn link ra ngoài hoặc không phải chuỗi', () => {
    expect(safeLink('//evil.com')).toBeNull()
    expect(safeLink('/\\evil.com')).toBeNull()
    expect(safeLink('https://evil.com')).toBeNull()
    expect(safeLink('javascript:alert(1)')).toBeNull()
    expect(safeLink('')).toBeNull()
    expect(safeLink(null)).toBeNull()
  })
})

describe('notificationIcon', () => {
  it('loại lạ dùng chuông', () => {
    expect(notificationIcon('order_status')).toBe('📦')
    expect(notificationIcon('khac')).toBe('🔔')
  })
})

describe('markReadLocally', () => {
  const list = [
    { id: 1, read_at: null },
    { id: 2, read_at: null },
    { id: 3, read_at: '2026-12-20T00:00:00.000Z' },
  ]
  const now = new Date('2026-12-21T10:00:00Z')

  it('đánh dấu theo id, giữ nguyên thông báo đã đọc từ trước', () => {
    const r = markReadLocally(list, [1, 3], now)
    expect(r[0].read_at).toBe(now.toISOString())
    expect(r[1].read_at).toBeNull()
    expect(r[2].read_at).toBe('2026-12-20T00:00:00.000Z')
  })

  it('ids null = tất cả; không sửa mảng gốc', () => {
    const r = markReadLocally(list, null, now)
    expect(r.every((n) => n.read_at)).toBe(true)
    expect(list[0].read_at).toBeNull()
  })
})
