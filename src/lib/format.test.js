import { describe, it, expect } from 'vitest'
import { parseWholeNumber } from './format'

describe('parseWholeNumber – đọc giá, tồn kho người dùng gõ', () => {
  it('đọc số thường và số có dấu phân cách hàng nghìn', () => {
    expect(parseWholeNumber('1290000')).toBe(1290000)
    expect(parseWholeNumber(' 1.290.000 ')).toBe(1290000)
    expect(parseWholeNumber('1,290,000')).toBe(1290000)
    expect(parseWholeNumber('1 290 000')).toBe(1290000)
    expect(parseWholeNumber('0')).toBe(0)
    expect(parseWholeNumber(7)).toBe(7)
  })

  it('số thập phân, nhóm sai, trộn dấu → NaN (BUG-G2T2-01)', () => {
    expect(parseWholeNumber('1290000.00')).toBeNaN()
    expect(parseWholeNumber('1500.5')).toBeNaN()
    expect(parseWholeNumber('1.5')).toBeNaN()
    expect(parseWholeNumber('12.90.000')).toBeNaN()
    expect(parseWholeNumber('1.290,000')).toBeNaN()
    expect(parseWholeNumber('-5')).toBeNaN()
    expect(parseWholeNumber('')).toBeNaN()
    expect(parseWholeNumber('abc')).toBeNaN()
  })
})
