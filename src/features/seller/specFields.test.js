import { describe, expect, it } from 'vitest'
import { SELLER_SPECS, specsToForm, validateSpecs, visibleSpecFields } from './specFields'
import { SPEC_FIELDS } from '../../lib/specs'

const cpu = {
  socket: 'AM5',
  cores: 6,
  base_clock_ghz: 3.8,
  boost_clock_ghz: 5.1,
  tdp_w: 65,
  igpu: true,
}

// 14 ca theo bảng "Gợi ý cho Test2" trong docs/thong-so-bat-buoc.md
describe('validateSpecs – các ca của BA', () => {
  it('1. cpu đủ 6 khóa bắt buộc, trong khoảng → hợp lệ', () => {
    const r = validateSpecs('cpu', cpu)
    expect(r.errors).toEqual({})
    expect(r.warnings).toEqual({})
    expect(r.specs).toEqual(cpu)
  })

  it('2. cpu thiếu socket → lỗi ở socket', () => {
    const { socket: _, ...rest } = cpu
    expect(Object.keys(validateSpecs('cpu', rest).errors)).toEqual(['socket'])
  })

  it('3. xung tối đa < xung cơ bản → lỗi ở boost_clock_ghz', () => {
    const r = validateSpecs('cpu', { ...cpu, base_clock_ghz: 4.5, boost_clock_ghz: 4.2 })
    expect(Object.keys(r.errors)).toEqual(['boost_clock_ghz'])
  })

  it('4. tdp_w = 600 → lỗi ngoài khoảng hợp lệ', () => {
    expect(validateSpecs('cpu', { ...cpu, tdp_w: 600 }).errors.tdp_w).toMatch(/10–500/)
  })

  it('5. tdp_w = 250 → hợp lệ nhưng cảnh báo cho admin', () => {
    const r = validateSpecs('cpu', { ...cpu, tdp_w: 250 })
    expect(r.errors).toEqual({})
    expect(r.warnings.tdp_w).toMatch(/thường gặp/)
  })

  it('6. mainboard socket "am5" (viết thường) → lỗi', () => {
    const r = validateSpecs('mainboard', {
      socket: 'am5',
      ram_type: 'DDR5',
      form_factor: 'ATX',
      ram_slots: 4,
      max_ram_gb: 192,
    })
    expect(Object.keys(r.errors)).toEqual(['socket'])
  })

  it('7. ram modules = 3 → lỗi', () => {
    const r = validateSpecs('ram', {
      ram_type: 'DDR5',
      capacity_gb: 32,
      modules: 3,
      speed_mhz: 6000,
    })
    expect(Object.keys(r.errors)).toEqual(['modules'])
  })

  it('8. ssd M.2 nhưng kiểu 2.5" → lỗi ràng buộc chéo', () => {
    const r = validateSpecs('ssd', {
      interface: 'M.2 PCIe 4.0 X4',
      form_factor: '2.5"',
      capacity_gb: 1000,
    })
    expect(Object.keys(r.errors)).toEqual(['form_factor'])
  })

  it('9. case Mini ITX lắp mainboard ATX → lỗi ràng buộc chéo', () => {
    const r = validateSpecs('case', {
      case_type: 'Mini ITX Tower',
      form_factors: ['ATX'],
      max_gpu_length_mm: 320,
    })
    expect(Object.keys(r.errors)).toEqual(['form_factors'])
  })

  it('10. case form_factors rỗng → lỗi (ít nhất 1)', () => {
    const r = validateSpecs('case', {
      case_type: 'ATX Mid Tower',
      form_factors: [],
      max_gpu_length_mm: 320,
    })
    expect(r.errors.form_factors).toMatch(/ít nhất 1/)
  })

  it('11. tản nước thiếu radiator_mm → lỗi', () => {
    const r = validateSpecs('cooler', { cooler_type: 'liquid', sockets: ['AM5'] })
    expect(Object.keys(r.errors)).toEqual(['radiator_mm'])
  })

  it('12. tản khí không có radiator_mm → hợp lệ (ô ẩn, bỏ khi lưu)', () => {
    const r = validateSpecs('cooler', { cooler_type: 'air', sockets: ['AM5'], radiator_mm: '240' })
    expect(r.errors).toEqual({})
    expect(r.specs).toEqual({ cooler_type: 'air', sockets: ['AM5'] })
  })

  it('13. vga length_mm là chuỗi "300" → đổi sang số rồi mới kiểm', () => {
    const r = validateSpecs('vga', {
      chipset: 'GeForce RTX 5060',
      vram_gb: '8',
      length_mm: '300',
      tdp_w: '145',
    })
    expect(r.errors).toEqual({})
    expect(r.specs.length_mm).toBe(300)
  })

  it('14. khóa lạ (rgb: true) → bỏ khi lưu, không báo lỗi', () => {
    const r = validateSpecs('cpu', { ...cpu, rgb: true })
    expect(r.errors).toEqual({})
    expect(r.specs).not.toHaveProperty('rgb')
  })
})

describe('validateSpecs – thêm', () => {
  it('đổi kiểu từ form: "4,7" → 4.7, "true" → true, ô chọn số → số', () => {
    const r = validateSpecs('cpu', { ...cpu, boost_clock_ghz: '5,15', igpu: 'false' })
    expect(r.specs.boost_clock_ghz).toBe(5.2)
    expect(r.specs.igpu).toBe(false)
    const ram = validateSpecs('ram', {
      ram_type: 'DDR4',
      capacity_gb: '16',
      modules: '2',
      speed_mhz: '3200',
    })
    expect(ram.specs.modules).toBe(2)
  })

  it('số luồng < số nhân → lỗi; ô không bắt buộc để trống → bỏ qua', () => {
    expect(Object.keys(validateSpecs('cpu', { ...cpu, threads: '4', cores: '8' }).errors)).toEqual([
      'threads',
    ])
    expect(validateSpecs('cpu', { ...cpu, threads: '' }).specs).not.toHaveProperty('threads')
  })

  it('nhập chữ vào ô số → lỗi kiểu', () => {
    expect(validateSpecs('cpu', { ...cpu, cores: 'sáu' }).errors.cores).toMatch(/số nguyên/)
  })

  it('ô chọn nhiều giữ thứ tự danh sách gốc', () => {
    const r = validateSpecs('cooler', { cooler_type: 'air', sockets: ['LGA1700', 'AM4'] })
    expect(r.specs.sockets).toEqual(['AM4', 'LGA1700'])
  })

  it('case MicroATX không lắp ATX', () => {
    const r = validateSpecs('case', {
      case_type: 'MicroATX Mini Tower',
      form_factors: ['ATX', 'Micro ATX'],
      max_gpu_length_mm: 300,
    })
    expect(r.errors.form_factors).toBeDefined()
  })

  it('ẩn radiator_mm với tản khí', () => {
    expect(visibleSpecFields('cooler', { cooler_type: 'air' }).map((f) => f.key)).not.toContain(
      'radiator_mm',
    )
    expect(visibleSpecFields('cooler', { cooler_type: 'liquid' }).map((f) => f.key)).toContain(
      'radiator_mm',
    )
  })
})

describe('specsToForm', () => {
  it('specs đã lưu → chuỗi cho ô nhập, mảng cho ô chọn nhiều; validate lại ra đúng như cũ', () => {
    const form = specsToForm('cpu', cpu)
    expect(form.cores).toBe('6')
    expect(form.igpu).toBe('true')
    expect(validateSpecs('cpu', form).specs).toEqual(cpu)
    expect(specsToForm('case', {}).form_factors).toEqual([])
  })
})

it('mọi khóa người bán nhập đều có nhãn hiển thị trên trang chi tiết (lib/specs.js)', () => {
  for (const [slug, fields] of Object.entries(SELLER_SPECS)) {
    const shown = SPEC_FIELDS[slug].map((f) => f.key)
    for (const f of fields) expect(shown, `${slug}.${f.key}`).toContain(f.key)
  }
})
