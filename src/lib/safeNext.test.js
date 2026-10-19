import { describe, expect, it } from 'vitest'
import { safeNext } from './safeNext'

describe('safeNext', () => {
  it('giữ đường dẫn trong web', () => {
    expect(safeNext('/tai-khoan')).toBe('/tai-khoan')
    expect(safeNext('/danh-muc/cpu?sort=name')).toBe('/danh-muc/cpu?sort=name')
  })

  it('chặn link sang trang khác', () => {
    expect(safeNext('https://trang-gia.com')).toBe('/')
    expect(safeNext('//trang-gia.com')).toBe('/')
    expect(safeNext('/\\trang-gia.com')).toBe('/')
    expect(safeNext(null)).toBe('/')
  })

  it('chặn ký tự tab/xuống dòng (trình duyệt xóa đi thành "//trang-gia.com")', () => {
    expect(safeNext('/\t/trang-gia.com')).toBe('/')
    expect(safeNext('/\n/trang-gia.com')).toBe('/')
    expect(safeNext('/\r/trang-gia.com')).toBe('/')
  })
})
