import { describe, expect, it } from 'vitest'
import raw from '../../../data/products.json'
import { checkCompatibility } from './compatibility'
import { buildTotalPrice, serializeBuild, parseStoredBuild } from './builder'
import {
  PURPOSES,
  TIERS,
  chipKey,
  cpuScore,
  gpuScore,
  suggestBuilds,
  toBuilderState,
} from './budget'

// Bộ dữ liệu thật (120 sản phẩm), đổi sang đúng dạng Builder dùng: có id, categories.slug.
const products = raw.map((p, i) => ({ ...p, id: i + 1, categories: { slug: p.slug } }))
const byName = (name) => products.find((p) => p.name === name)

const BUDGETS = [10e6, 15e6, 25e6, 40e6, 80e6]
const PURPOSE_KEYS = Object.keys(PURPOSES)

describe('suggestBuilds – mọi gợi ý đều mua được và lắp được', () => {
  for (const purpose of PURPOSE_KEYS) {
    for (const budget of BUDGETS) {
      it(`${purpose}, ${budget / 1e6} triệu`, () => {
        const { builds } = suggestBuilds(products, { budget, purpose })
        expect(builds.length).toBeLessThanOrEqual(3)
        for (const b of builds) {
          // Hợp lệ theo bộ quy tắc R1–R9, đủ linh kiện
          const check = checkCompatibility({ ...b.parts, ramQty: b.ramQty })
          expect(check.errors).toEqual([])
          expect(check.complete).toBe(true)
          // Không vượt ngân sách, tổng tiền tính đúng
          expect(b.total).toBeLessThanOrEqual(budget)
          expect(b.total).toBe(buildTotalPrice(b.parts, b.ramQty))
          // Chỉ dùng hàng còn trong kho
          for (const p of Object.values(b.parts)) expect(p.stock).toBeGreaterThan(0)
          // Nhu cầu cần VGA rời thì phải có VGA
          if (PURPOSES[purpose].needVga) expect(b.parts.vga).toBeTruthy()
          // RAM, SSD đạt mức tối thiểu của nhu cầu, RAM không vượt mức tối đa
          expect(b.parts.ram.specs.capacity_gb).toBeGreaterThanOrEqual(PURPOSES[purpose].minRamGb)
          expect(b.parts.ram.specs.capacity_gb).toBeLessThanOrEqual(PURPOSES[purpose].maxRamGb)
          expect(b.parts.ssd.specs.capacity_gb).toBeGreaterThanOrEqual(PURPOSES[purpose].minSsdGb)
        }
      })
    }
  }
})

describe('suggestBuilds – thứ tự và khác biệt giữa các mức', () => {
  it('ngân sách vừa phải cho đủ 3 mức, mỗi mức rẻ hơn và yếu hơn mức trước', () => {
    const { builds } = suggestBuilds(products, { budget: 40e6, purpose: 'gaming' })
    expect(builds.map((b) => b.tier)).toEqual(TIERS.map((t) => t.key))
    for (let i = 1; i < builds.length; i++) {
      expect(builds[i].total).toBeLessThan(builds[i - 1].total)
      expect(builds[i].score).toBeLessThan(builds[i - 1].score)
    }
  })

  it('mỗi mức nằm trong tỷ lệ ngân sách của nó (100%, 85%, 70%)', () => {
    const budget = 40e6
    const { builds } = suggestBuilds(products, { budget, purpose: 'design' })
    for (const b of builds) {
      const ratio = TIERS.find((t) => t.key === b.tier).ratio
      expect(b.total).toBeLessThanOrEqual(budget * ratio)
    }
  })

  it('không có 2 gợi ý cùng cặp CPU + VGA', () => {
    for (const purpose of PURPOSE_KEYS) {
      const { builds } = suggestBuilds(products, { budget: 40e6, purpose })
      const pairs = builds.map((b) => `${b.parts.cpu.id}-${b.parts.vga?.id}`)
      expect(new Set(pairs).size).toBe(pairs.length)
    }
  })

  it('tăng ngân sách thì gợi ý mạnh nhất không yếu đi', () => {
    for (const purpose of PURPOSE_KEYS) {
      const best = BUDGETS.map(
        (budget) => suggestBuilds(products, { budget, purpose }).builds[0]?.score ?? 0,
      )
      for (let i = 1; i < best.length; i++) expect(best[i]).toBeGreaterThanOrEqual(best[i - 1])
    }
  })

  it('văn phòng: CPU có iGPU thì không mua VGA rời', () => {
    const { builds } = suggestBuilds(products, { budget: 15e6, purpose: 'office' })
    expect(builds.length).toBeGreaterThan(0)
    for (const b of builds) {
      if (b.parts.cpu.specs.igpu) expect(b.parts.vga).toBeUndefined()
    }
  })
})

describe('suggestBuilds – ngân sách không đủ, dữ liệu vào sai', () => {
  it('ngân sách thấp hơn cấu hình rẻ nhất: không gợi ý, báo số tiền tối thiểu', () => {
    const r = suggestBuilds(products, { budget: 5e6, purpose: 'gaming' })
    expect(r.builds).toEqual([])
    expect(r.minTotal).toBeGreaterThan(5e6)
    // Đúng bằng minTotal thì có ít nhất 1 gợi ý
    expect(suggestBuilds(products, { budget: r.minTotal, purpose: 'gaming' }).builds).toHaveLength(
      1,
    )
  })

  it('bỏ qua sản phẩm hết hàng', () => {
    // Hết sạch VGA → chơi game không gợi ý được gì
    const noVga = products.map((p) => (p.slug === 'vga' ? { ...p, stock: 0 } : p))
    const r = suggestBuilds(noVga, { budget: 80e6, purpose: 'gaming' })
    expect(r.builds).toEqual([])
    expect(r.minTotal).toBeNull()
  })

  it('ngân sách hoặc nhu cầu không hợp lệ thì báo lỗi', () => {
    expect(() => suggestBuilds(products, { budget: NaN })).toThrow(/Ngân sách/)
    expect(() => suggestBuilds(products, { budget: 500_000 })).toThrow(/Ngân sách/)
    expect(() => suggestBuilds(products, { budget: 1e12 })).toThrow(/Ngân sách/)
    expect(() => suggestBuilds(products, { budget: 20e6, purpose: 'mining' })).toThrow(/Nhu cầu/)
  })
})

describe('chấm điểm CPU, VGA', () => {
  it('chipKey bỏ tên hãng và dung lượng', () => {
    expect(chipKey('GeForce RTX 3060 12GB')).toBe('RTX 3060')
    expect(chipKey('GeForce RTX 4060 Ti')).toBe('RTX 4060 Ti')
    expect(chipKey('Radeon RX 9070 XT')).toBe('RX 9070 XT')
  })

  it('VGA mạnh hơn được điểm cao hơn; chip lạ ước theo công suất', () => {
    const rtx5080 = byName('Gigabyte GeForce RTX 5080 WINDFORCE OC SFF 16GB')
    const rx6500 = byName('ASRock Radeon RX 6500 XT Phantom Gaming D OC 4GB')
    expect(gpuScore(rtx5080)).toBeGreaterThan(gpuScore(rx6500))
    expect(gpuScore({ specs: { chipset: 'Arc B580', tdp_w: 190 } })).toBe(114)
    expect(gpuScore(null)).toBe(0)
  })

  it('đồ họa ưu tiên nhiều nhân, game giới hạn 8 nhân', () => {
    const i9 = byName('Intel Core i9-13900F') // 24 nhân
    const r7 = byName('AMD Ryzen 7 9700X') // 8 nhân
    expect(cpuScore(i9, 'design')).toBeGreaterThan(cpuScore(r7, 'design') * 2)
    // Game: cùng 8 nhân → chỉ khác xung nhịp
    expect(cpuScore(i9, 'gaming')).toBeCloseTo(8 * 5.6)
    expect(cpuScore(r7, 'gaming')).toBeCloseTo(8 * 5.5)
  })
})

describe('toBuilderState – mở gợi ý trong Builder', () => {
  it('ra đúng dạng Builder lưu trong localStorage', () => {
    const [b] = suggestBuilds(products, { budget: 25e6, purpose: 'gaming' }).builds
    const state = toBuilderState(b)
    expect(state.ramQty).toBe(1)
    expect(Object.keys(state.ids).sort()).toEqual(Object.keys(b.parts).sort())
    // Qua serialize → parse (cách Builder đọc) vẫn giữ nguyên
    expect(parseStoredBuild(serializeBuild(state.ids, state.ramQty))).toEqual(state)
  })
})
