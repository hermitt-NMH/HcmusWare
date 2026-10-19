import { describe, expect, it } from 'vitest'
import products from '../../../data/products.json'
import { calcRecommendedPsuW, checkCompatibility } from './compatibility'

// Test case lấy từ docs/test-plan.md (TC01–TC20).

// Cấu hình gốc B0: 8 sản phẩm mẫu trong supabase/seed.sql (hợp lệ hoàn toàn).
const B0 = {
  cpu: {
    name: 'AMD Ryzen 5 7600',
    specs: { socket: 'AM5', tdp_w: 65, cores: 6, threads: 12, igpu: true },
  },
  mainboard: {
    name: 'MSI PRO B650M-A WIFI',
    specs: {
      socket: 'AM5',
      ram_type: 'DDR5',
      form_factor: 'Micro ATX',
      ram_slots: 4,
      max_ram_gb: 192,
    },
  },
  ram: {
    name: 'Kingston FURY Beast 32GB (2x16GB) DDR5-6000',
    specs: { ram_type: 'DDR5', speed_mhz: 6000, modules: 2, capacity_gb: 32 },
  },
  ramQty: 1,
  vga: {
    name: 'ASUS Dual GeForce RTX 4060 8GB',
    specs: { chipset: 'GeForce RTX 4060', length_mm: 227, tdp_w: 115 },
  },
  ssd: { name: 'Samsung 990 EVO 1TB', specs: { capacity_gb: 1000 } },
  psu: { name: 'Corsair RM750e 750W', specs: { wattage_w: 750, form_factor: 'ATX' } },
  case: {
    name: 'NZXT H5 Flow',
    specs: {
      case_type: 'ATX Mid Tower',
      form_factors: ['ATX', 'Micro ATX', 'Mini ITX'],
      max_gpu_length_mm: 365,
    },
  },
  cooler: {
    name: 'Thermalright Peerless Assassin 120 SE',
    specs: { sockets: ['AM4', 'AM5', 'LGA1700', 'LGA1851'], radiator_mm: null },
  },
}

// Lấy sản phẩm theo đúng tên trong bộ dữ liệu (data/products.json).
function p(name) {
  const found = products.find((x) => x.name === name)
  if (!found) throw new Error(`Không tìm thấy sản phẩm "${name}" trong data/products.json`)
  return found
}

// B0 thay đúng các linh kiện trong "changes".
const build = (changes = {}) => ({ ...B0, ...changes })
const rules = (list) => list.map((x) => x.rule)

describe('checkCompatibility – test plan TC01–TC20', () => {
  it('TC01: cấu hình gốc B0 hợp lệ hoàn toàn', () => {
    const r = checkCompatibility(B0)
    expect(r.errors).toEqual([])
    expect(r.warnings).toEqual([])
    expect(r.totalPowerW).toBe(280)
    expect(r.recommendedPsuW).toBe(400)
    expect(r.complete).toBe(true)
  })

  it('TC02: R1 – CPU Intel trên mainboard AM5', () => {
    const r = checkCompatibility(build({ cpu: p('Intel Core i5-12400') }))
    expect(rules(r.errors)).toEqual(['R1'])
    expect(r.errors[0].message).toBe('CPU socket LGA1700 không lắp được mainboard socket AM5')
  })

  it('TC03: R1 – CPU và mainboard cùng LGA1700 thì hợp lệ', () => {
    const r = checkCompatibility(
      build({ cpu: p('Intel Core i5-12400'), mainboard: p('Gigabyte B760 DS3H AX') }),
    )
    expect(r.errors).toEqual([])
  })

  it('TC04: R2 – RAM DDR4 trên mainboard DDR5', () => {
    const r = checkCompatibility(
      build({ ram: p('Corsair Vengeance RGB Pro 32 GB (2x16GB) DDR4-3600') }),
    )
    expect(rules(r.errors)).toEqual(['R2'])
  })

  it('TC05: R3 – 2 kit × 2 thanh trên mainboard 2 khe', () => {
    const r = checkCompatibility(build({ mainboard: p('Asus PRIME B650M-K'), ramQty: 2 }))
    expect(rules(r.errors)).toEqual(['R3'])
    expect(r.errors[0].message).toBe('Cần 4 khe RAM nhưng mainboard chỉ có 2 khe')
  })

  it('TC06: R3 + R4 – 128 GB vượt 96 GB', () => {
    const r = checkCompatibility(
      build({
        mainboard: p('Asus PRIME B650M-K'),
        ram: p('Corsair Vengeance RGB 64 GB (2x32GB) DDR5-6000'),
        ramQty: 2,
      }),
    )
    expect(rules(r.errors)).toEqual(['R3', 'R4'])
    expect(r.errors[1].message).toBe('Tổng 128 GB vượt mức tối đa 96 GB của mainboard')
  })

  it('TC07: R5 – mainboard ATX trong case MicroATX', () => {
    const r = checkCompatibility(
      build({
        cpu: p('Intel Core i5-12400'),
        mainboard: p('Gigabyte B760 DS3H AX'),
        case: p('Zalman CUBIX'),
      }),
    )
    expect(rules(r.errors)).toEqual(['R5'])
  })

  it('TC08: R6 biên – VGA 312 mm vừa case 312 mm', () => {
    const r = checkCompatibility(
      build({
        case: p('Silverstone RV05B'),
        vga: p('ASRock Radeon RX 7900 XT Creator 20GB'),
      }),
    )
    expect(r.errors).toEqual([])
    expect(r.totalPowerW).toBe(480)
    expect(r.recommendedPsuW).toBe(650)
    expect(r.warnings).toEqual([])
  })

  it('TC09: R6 – VGA 356 mm trong case 260 mm', () => {
    const r = checkCompatibility(
      build({ case: p('Zalman CUBIX'), vga: p('Zotac GeForce RTX 3080 Ti AMP Extreme Holo 12GB') }),
    )
    expect(rules(r.errors)).toEqual(['R6'])
    expect(r.errors[0].message).toBe('VGA dài 356 mm, case chỉ chứa tối đa 260 mm')
  })

  // Mọi tản đang bán đều hỗ trợ đủ 4 socket nên ca "không đạt" dùng tản giả chỉ lắp được AMD.
  it('TC10: R7 – tản nhiệt không hỗ trợ LGA1851', () => {
    const r = checkCompatibility(
      build({
        cpu: p('Intel Core Ultra 5 235'),
        mainboard: p('Gigabyte B860M D3HP'),
        cooler: { name: 'Tản giả chỉ hỗ trợ AMD', specs: { sockets: ['AM4', 'AM5'] } },
      }),
    )
    expect(rules(r.errors)).toEqual(['R7'])
    expect(r.errors[0].message).toBe('Tản nhiệt không hỗ trợ socket LGA1851')
  })

  it('TC10b: R7 – tản mẫu B0 lắp được LGA1851 (chung ngàm LGA1700)', () => {
    const r = checkCompatibility(
      build({ cpu: p('Intel Core Ultra 5 235'), mainboard: p('Gigabyte B860M D3HP') }),
    )
    expect(r.errors).toEqual([])
  })

  it('TC11: R8 – nguồn 500 W không đủ cho 525 W', () => {
    const r = checkCompatibility(
      build({
        vga: p('Gigabyte GeForce RTX 5080 WINDFORCE OC SFF 16GB'),
        psu: p('Thermaltake Smart'),
      }),
    )
    expect(rules(r.errors)).toEqual(['R8'])
    expect(r.totalPowerW).toBe(525)
  })

  it('TC12: W1 – nguồn đủ nhưng sát mức', () => {
    const r = checkCompatibility(
      build({
        vga: p('Gigabyte GeForce RTX 5080 WINDFORCE OC SFF 16GB'),
        psu: p('SeaSonic G12 GC'),
      }),
    )
    expect(r.errors).toEqual([])
    expect(rules(r.warnings)).toEqual(['W1'])
    expect(r.recommendedPsuW).toBe(700)
  })

  it('TC13: R9 – CPU không iGPU và chưa chọn VGA', () => {
    const r = checkCompatibility(
      build({ cpu: p('Intel Core i3-14100F'), mainboard: p('Gigabyte B760 DS3H AX'), vga: null }),
    )
    expect(rules(r.errors)).toEqual(['R9'])
    expect(r.complete).toBe(false)
  })

  it('TC14: R9 – CPU có iGPU thì không cần VGA', () => {
    const r = checkCompatibility(
      build({ cpu: p('Intel Core i5-12400'), mainboard: p('Gigabyte B760 DS3H AX'), vga: null }),
    )
    expect(r.errors).toEqual([])
    expect(r.complete).toBe(true)
    expect(r.totalPowerW).toBe(165)
    expect(r.recommendedPsuW).toBe(250)
  })

  it('TC15: W2 – nguồn SFX trong case ATX', () => {
    const r = checkCompatibility(build({ psu: p('Silverstone SFX') }))
    expect(r.errors).toEqual([])
    expect(rules(r.warnings)).toEqual(['W2'])
  })

  it('TC16: W4 – két nước 360 mm trong case MicroATX', () => {
    const r = checkCompatibility(
      build({ case: p('Zalman CUBIX'), cooler: p('Thermalright Mjolnir Vision 360 ARGB') }),
    )
    expect(r.errors).toEqual([])
    expect(rules(r.warnings)).toEqual(['W4'])
  })

  it('TC17: W5 – VGA thiếu chiều dài thì bỏ qua R6, chỉ cảnh báo', () => {
    const r = checkCompatibility(
      build({ vga: { name: 'VGA giả', specs: { length_mm: null, tdp_w: 115 } } }),
    )
    expect(rules(r.errors)).not.toContain('R6')
    expect(rules(r.warnings)).toEqual(['W5'])
  })

  it('TC18: chỉ chọn CPU thì không báo lỗi', () => {
    const r = checkCompatibility({ cpu: B0.cpu })
    expect(r.errors).toEqual([])
    expect(r.complete).toBe(false)
  })

  it('TC19: công suất cpu 100 W + vga 250 W', () => {
    const r = checkCompatibility({ cpu: { specs: { tdp_w: 100 } }, vga: { specs: { tdp_w: 250 } } })
    expect(r.totalPowerW).toBe(450)
    expect(r.recommendedPsuW).toBe(600)
  })

  it('TC20: công suất cpu 50 W, không chọn VGA', () => {
    const r = checkCompatibility({ cpu: { specs: { tdp_w: 50, igpu: true } }, vga: null })
    expect(r.totalPowerW).toBe(150)
    expect(r.recommendedPsuW).toBe(200)
  })
})

describe('checkCompatibility – trường hợp thêm', () => {
  it('chưa chọn gì: không lỗi, công suất 0, chưa đủ cấu hình', () => {
    expect(checkCompatibility({})).toEqual({
      errors: [],
      warnings: [],
      totalPowerW: 0,
      recommendedPsuW: 0,
      complete: false,
    })
  })

  it('W3 – nguồn ATX trong case Mini ITX Tower', () => {
    const r = checkCompatibility(
      build({
        case: {
          name: 'Case ITX giả',
          specs: {
            case_type: 'Mini ITX Tower',
            form_factors: ['Mini ITX'],
            max_gpu_length_mm: 320,
          },
        },
      }),
    )
    expect(rules(r.warnings)).toContain('W3')
  })

  it('thông số ước lượng chỉ cảnh báo một lần dù nhiều quy tắc dùng chung', () => {
    // cpu.socket dùng cho cả R1 và R7
    const cpu = { name: 'CPU giả', specs: { ...B0.cpu.specs, estimated: ['socket'] } }
    const r = checkCompatibility(build({ cpu }))
    expect(r.warnings.filter((w) => w.rule === 'W5')).toHaveLength(1)
  })

  it('làm tròn PSU đề xuất lên bội số 50, không lệch do số thực', () => {
    expect(calcRecommendedPsuW(250)).toBe(350) // 325 → 350
    expect(calcRecommendedPsuW(500)).toBe(650) // 650 đúng bằng → giữ nguyên
  })
})
