import { describe, expect, it } from 'vitest'
import {
  compactSeries,
  generatePriceSeries,
  isAlertTriggered,
  parsePriceInput,
  summarizeHistory,
  validateTargetPrice,
  withCurrentPrice,
} from './price'

const now = new Date('2026-11-09T00:00:00Z')

describe('generatePriceSeries', () => {
  const series = generatePriceSeries(5490000, { seed: 42, now })

  it('khoảng 6 tháng, mỗi tuần một điểm, tăng dần theo thời gian', () => {
    expect(series.length).toBe(27) // 26 tuần trước + hôm nay
    const times = series.map((p) => Date.parse(p.recorded_at))
    expect([...times].sort((a, b) => a - b)).toEqual(times)
    const days = (times.at(-1) - times[0]) / 86400000
    expect(days).toBeGreaterThanOrEqual(175)
  })

  it('kết thúc đúng bằng giá hiện tại ở thời điểm now', () => {
    expect(series.at(-1)).toEqual({ price: 5490000, recorded_at: now.toISOString() })
  })

  it('giá làm tròn 10.000 ₫ và nằm trong 75%–130% giá hiện tại', () => {
    for (const { price } of series) {
      expect(price % 10000).toBe(0)
      expect(price).toBeGreaterThanOrEqual(5490000 * 0.75 - 10000)
      expect(price).toBeLessThanOrEqual(5490000 * 1.3 + 10000)
    }
  })

  it('cùng seed cho cùng kết quả, khác seed thì khác', () => {
    expect(generatePriceSeries(5490000, { seed: 42, now })).toEqual(series)
    expect(generatePriceSeries(5490000, { seed: 7, now })).not.toEqual(series)
  })
})

describe('compactSeries', () => {
  it('bỏ điểm trùng giá liền nhau, giữ điểm cuối', () => {
    const pts = [100, 100, 200, 200, 200].map((price, i) => ({ price, recorded_at: String(i) }))
    expect(compactSeries(pts).map((p) => p.recorded_at)).toEqual(['0', '2', '4'])
  })
})

describe('summarizeHistory', () => {
  it('thấp nhất, cao nhất, % thay đổi', () => {
    const s = summarizeHistory([{ price: 200 }, { price: 150 }, { price: 180 }])
    expect(s).toMatchObject({ min: 150, max: 200, first: 200, last: 180, changePct: -10 })
  })
  it('không có lịch sử thì null', () => {
    expect(summarizeHistory([])).toBeNull()
  })
})

describe('withCurrentPrice', () => {
  it('thêm giá hiện tại khi khác điểm cuối', () => {
    expect(withCurrentPrice([{ price: 100, recorded_at: 'a' }], 90, now)).toHaveLength(2)
    expect(withCurrentPrice([{ price: 100, recorded_at: 'a' }], 100, now)).toHaveLength(1)
    expect(withCurrentPrice([], 100, now)).toEqual([{ price: 100, recorded_at: now.toISOString() }])
  })
})

describe('giá mong muốn', () => {
  it('đọc nhiều kiểu gõ', () => {
    expect(parsePriceInput('5.000.000')).toBe(5000000)
    expect(parsePriceInput('5,000,000 đ')).toBe(5000000)
    expect(parsePriceInput('abc')).toBeNull()
    expect(parsePriceInput('0')).toBeNull()
  })

  it('phải thấp hơn giá hiện tại và tối thiểu 10.000 ₫', () => {
    expect(validateTargetPrice(null, 100000)).toBeTruthy()
    expect(validateTargetPrice(5000, 100000)).toBeTruthy()
    expect(validateTargetPrice(100000, 100000)).toBeTruthy()
    expect(validateTargetPrice(90000, 100000)).toBe('')
  })

  it('cảnh báo nổ khi giá ≤ mục tiêu và chưa xem', () => {
    const alert = { target_price: 100, notified: false, products: { price: 100 } }
    expect(isAlertTriggered(alert)).toBe(true)
    expect(isAlertTriggered({ ...alert, products: { price: 101 } })).toBe(false)
    expect(isAlertTriggered({ ...alert, notified: true })).toBe(false)
  })
})
