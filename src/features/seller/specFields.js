// Thông số bắt buộc khi người bán đăng sản phẩm (F14) – bản chính thức: docs/thong-so-bat-buoc.md.
// HÀM THUẦN để test. Tên khóa giữ đúng dữ liệu hiện có vì compatibility.js và budget.js đọc theo tên này.
// Cần thêm giá trị mới (socket mới...) thì sửa danh sách ở file này qua Pull Request.
//
// Kiểu ô (type):
//   select – chọn 1 trong options          multi – chọn nhiều, ít nhất 1
//   int    – số nguyên                     decimal – số thập phân (làm tròn 1 chữ số)
//   bool   – Có / Không                    text – chữ (minLength–maxLength)
// range: khoảng hợp lệ (ngoài khoảng → không lưu được)
// common: khoảng thường gặp (ngoài khoảng vẫn lưu, màn hình duyệt của admin tô vàng)
// showIf(specs): chỉ hiện (và chỉ bắt buộc) khi trả true; ẩn thì bỏ khóa đó khi lưu.

export const SOCKETS = ['AM4', 'AM5', 'LGA1700', 'LGA1851']
const RAM_TYPES = ['DDR4', 'DDR5']
const BOARD_SIZES = ['ATX', 'Micro ATX', 'Mini ITX']

export const SELLER_SPECS = {
  cpu: [
    { key: 'socket', label: 'Socket', type: 'select', options: SOCKETS, required: true },
    {
      key: 'cores',
      label: 'Số nhân',
      type: 'int',
      required: true,
      range: [1, 128],
      common: [4, 24],
    },
    { key: 'threads', label: 'Số luồng', type: 'int', range: [1, 256], common: [4, 32] },
    {
      key: 'base_clock_ghz',
      label: 'Xung cơ bản',
      unit: 'GHz',
      type: 'decimal',
      required: true,
      range: [0.5, 7],
      common: [2, 5],
    },
    {
      key: 'boost_clock_ghz',
      label: 'Xung tối đa',
      unit: 'GHz',
      type: 'decimal',
      required: true,
      range: [0.5, 7],
      common: [4, 6],
    },
    {
      key: 'tdp_w',
      label: 'TDP',
      unit: 'W',
      type: 'int',
      required: true,
      range: [10, 500],
      common: [35, 170],
    },
    { key: 'igpu', label: 'Có nhân đồ họa tích hợp', type: 'bool', required: true },
  ],
  mainboard: [
    { key: 'socket', label: 'Socket', type: 'select', options: SOCKETS, required: true },
    { key: 'ram_type', label: 'Chuẩn RAM', type: 'select', options: RAM_TYPES, required: true },
    {
      key: 'form_factor',
      label: 'Kích thước',
      type: 'select',
      options: BOARD_SIZES,
      required: true,
    },
    { key: 'ram_slots', label: 'Số khe RAM', type: 'select', options: [2, 4], required: true },
    {
      key: 'max_ram_gb',
      label: 'RAM tối đa',
      unit: 'GB',
      type: 'int',
      required: true,
      range: [8, 512],
      common: [64, 256],
    },
  ],
  ram: [
    { key: 'ram_type', label: 'Chuẩn RAM', type: 'select', options: RAM_TYPES, required: true },
    {
      key: 'capacity_gb',
      label: 'Tổng dung lượng kit',
      unit: 'GB',
      type: 'int',
      required: true,
      range: [4, 256],
      common: [8, 64],
      hint: 'Dung lượng cả kit: kit 2 × 16 GB nhập 32.',
    },
    {
      key: 'modules',
      label: 'Số thanh trong kit',
      type: 'select',
      options: [1, 2, 4],
      required: true,
    },
    {
      key: 'speed_mhz',
      label: 'Bus',
      unit: 'MHz',
      type: 'int',
      required: true,
      range: [1600, 10000],
      common: [3000, 7200],
    },
  ],
  vga: [
    {
      key: 'chipset',
      label: 'Chip đồ họa',
      type: 'text',
      required: true,
      minLength: 3,
      maxLength: 60,
      placeholder: 'GeForce RTX 5060',
    },
    {
      key: 'vram_gb',
      label: 'VRAM',
      unit: 'GB',
      type: 'int',
      required: true,
      range: [1, 48],
      common: [4, 20],
    },
    {
      key: 'length_mm',
      label: 'Chiều dài card',
      unit: 'mm',
      type: 'int',
      required: true,
      range: [100, 450],
      common: [200, 360],
    },
    {
      key: 'tdp_w',
      label: 'Công suất tiêu thụ',
      unit: 'W',
      type: 'int',
      required: true,
      range: [20, 700],
      common: [100, 360],
    },
  ],
  ssd: [
    {
      key: 'interface',
      label: 'Giao tiếp',
      type: 'select',
      options: ['SATA 6.0 Gb/s', 'M.2 PCIe 3.0 X4', 'M.2 PCIe 4.0 X4', 'M.2 PCIe 5.0 X4'],
      required: true,
    },
    {
      key: 'form_factor',
      label: 'Kiểu',
      type: 'select',
      options: ['2.5"', 'M.2-2280'],
      required: true,
    },
    {
      key: 'capacity_gb',
      label: 'Dung lượng',
      unit: 'GB',
      type: 'int',
      required: true,
      range: [64, 16000],
      common: [256, 2000],
      hint: '1 TB = 1000 GB.',
    },
  ],
  psu: [
    {
      key: 'wattage_w',
      label: 'Công suất',
      unit: 'W',
      type: 'int',
      required: true,
      range: [200, 2000],
      common: [500, 1300],
    },
    {
      key: 'efficiency',
      label: 'Chứng nhận',
      type: 'select',
      options: [
        '80+',
        '80+ Bronze',
        '80+ Silver',
        '80+ Gold',
        '80+ Platinum',
        '80+ Titanium',
        'Không có',
      ],
      required: true,
    },
    {
      key: 'modular',
      label: 'Kiểu dây',
      type: 'select',
      options: [
        { value: 'No', label: 'Liền dây' },
        { value: 'Semi', label: 'Bán rời' },
        { value: 'Full', label: 'Rời hoàn toàn' },
      ],
      required: true,
    },
    {
      key: 'form_factor',
      label: 'Kích thước',
      type: 'select',
      options: ['ATX', 'SFX'],
      required: true,
    },
  ],
  case: [
    {
      key: 'case_type',
      label: 'Loại case',
      type: 'select',
      options: [
        'ATX Full Tower',
        'ATX Mid Tower',
        'MicroATX Mid Tower',
        'MicroATX Mini Tower',
        'Mini ITX Tower',
      ],
      required: true,
    },
    {
      key: 'form_factors',
      label: 'Mainboard lắp được',
      type: 'multi',
      options: BOARD_SIZES,
      required: true,
    },
    {
      key: 'max_gpu_length_mm',
      label: 'Chiều dài VGA tối đa',
      unit: 'mm',
      type: 'int',
      required: true,
      range: [150, 500],
      common: [260, 420],
    },
  ],
  cooler: [
    {
      key: 'cooler_type',
      label: 'Loại',
      type: 'select',
      options: [
        { value: 'air', label: 'Tản khí' },
        { value: 'liquid', label: 'Tản nước AIO' },
      ],
      required: true,
    },
    { key: 'sockets', label: 'Socket hỗ trợ', type: 'multi', options: SOCKETS, required: true },
    {
      key: 'radiator_mm',
      label: 'Kích thước két nước',
      unit: 'mm',
      type: 'select',
      options: [120, 240, 280, 360, 420],
      required: true,
      showIf: (s) => s.cooler_type === 'liquid',
    },
    {
      key: 'max_tdp_w',
      label: 'TDP tối đa tản được',
      unit: 'W',
      type: 'int',
      range: [50, 400],
      common: [150, 300],
    },
  ],
}

// Ràng buộc giữa nhiều ô. Nhận specs đã đổi kiểu, trả { khóa: lỗi }.
const CROSS_RULES = {
  cpu: (s) => ({
    ...(s.threads != null && s.cores != null && s.threads < s.cores
      ? { threads: 'Số luồng phải ≥ số nhân.' }
      : {}),
    ...(s.boost_clock_ghz != null &&
    s.base_clock_ghz != null &&
    s.boost_clock_ghz < s.base_clock_ghz
      ? { boost_clock_ghz: 'Xung tối đa phải ≥ xung cơ bản.' }
      : {}),
  }),
  ssd: (s) =>
    s.interface?.startsWith('M.2') && s.form_factor && s.form_factor !== 'M.2-2280'
      ? { form_factor: 'SSD giao tiếp M.2 phải có kiểu M.2-2280.' }
      : {},
  case: (s) => {
    const type = s.case_type ?? ''
    const sizes = s.form_factors ?? []
    if (type.startsWith('Mini ITX') && sizes.some((f) => f !== 'Mini ITX'))
      return { form_factors: 'Case Mini ITX chỉ lắp được mainboard Mini ITX.' }
    if (type.startsWith('MicroATX') && sizes.includes('ATX'))
      return { form_factors: 'Case MicroATX không lắp được mainboard ATX.' }
    return {}
  },
}

export const optionValue = (o) => (typeof o === 'object' ? o.value : o)
export const optionLabel = (o) => (typeof o === 'object' ? o.label : String(o))

export function specFieldsFor(categorySlug) {
  return SELLER_SPECS[categorySlug] ?? []
}

// Các ô đang hiện với giá trị hiện tại (ẩn radiator_mm khi là tản khí...).
export function visibleSpecFields(categorySlug, specs = {}) {
  return specFieldsFor(categorySlug).filter((f) => !f.showIf || f.showIf(specs))
}

const isEmpty = (v) =>
  v == null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && !v.length)
const fmt = (n) => String(n).replace('.', ',')
const rangeText = ([min, max], unit) => `${fmt(min)}–${fmt(max)}${unit ? ' ' + unit : ''}`

// Một giá trị từ form (thường là chuỗi) → đúng kiểu lưu trong specs. Sai kiểu → { error }.
function parseValue(field, raw) {
  switch (field.type) {
    case 'int': {
      const n = typeof raw === 'number' ? raw : Number(String(raw).trim())
      return Number.isInteger(n) ? { value: n } : { error: 'Nhập số nguyên.' }
    }
    case 'decimal': {
      const n = typeof raw === 'number' ? raw : Number(String(raw).trim().replace(',', '.'))
      return Number.isFinite(n) ? { value: Math.round(n * 10) / 10 } : { error: 'Nhập số, vd 4,7.' }
    }
    case 'bool': {
      if (raw === true || raw === 'true') return { value: true }
      if (raw === false || raw === 'false') return { value: false }
      return { error: 'Chọn Có hoặc Không.' }
    }
    case 'select': {
      const match = field.options.map(optionValue).find((v) => String(v) === String(raw))
      return match === undefined ? { error: 'Chọn một giá trị trong danh sách.' } : { value: match }
    }
    case 'multi': {
      const list = Array.isArray(raw) ? raw : [raw]
      const allowed = field.options.map(optionValue)
      if (list.some((v) => !allowed.includes(v)))
        return { error: 'Có giá trị không nằm trong danh sách.' }
      // Giữ thứ tự của danh sách gốc để lưu ổn định (không phụ thuộc thứ tự bấm).
      return { value: allowed.filter((v) => list.includes(v)) }
    }
    default: {
      const text = String(raw).trim()
      if (text.length < (field.minLength ?? 0) || text.length > (field.maxLength ?? Infinity))
        return { error: `Từ ${field.minLength} đến ${field.maxLength} ký tự.` }
      return { value: text }
    }
  }
}

// Kiểm tra thông số của một danh mục.
// Trả { specs, errors, warnings }:
//   specs    – chỉ gồm các khóa khai báo ở trên, đã đổi đúng kiểu (khóa lạ, ô đang ẩn bị bỏ)
//   errors   – { khóa: lỗi }, rỗng là lưu được
//   warnings – { khóa: ghi chú } khi ngoài khoảng thường gặp (admin kiểm tra kỹ khi duyệt)
export function validateSpecs(categorySlug, raw = {}) {
  const specs = {}
  const errors = {}
  const warnings = {}
  const fields = specFieldsFor(categorySlug)

  // Đổi kiểu trước để showIf đọc được giá trị thật (vd cooler_type).
  for (const field of fields) {
    const value = raw[field.key]
    if (isEmpty(value)) continue
    const parsed = parseValue(field, value)
    if (parsed.error) errors[field.key] = parsed.error
    else specs[field.key] = parsed.value
  }

  for (const field of fields) {
    const { key } = field
    if (field.showIf && !field.showIf(specs)) {
      delete specs[key]
      delete errors[key]
      continue
    }
    if (errors[key]) continue
    const value = specs[key]
    if (value === undefined) {
      if (field.required) errors[key] = field.type === 'multi' ? 'Chọn ít nhất 1.' : 'Bắt buộc.'
      continue
    }
    if (field.range && (value < field.range[0] || value > field.range[1])) {
      errors[key] = `Phải trong khoảng ${rangeText(field.range, field.unit)}.`
    } else if (field.common && (value < field.common[0] || value > field.common[1])) {
      warnings[key] = `Ngoài khoảng thường gặp ${rangeText(field.common, field.unit)}.`
    }
  }

  for (const [key, message] of Object.entries(CROSS_RULES[categorySlug]?.(specs) ?? {})) {
    errors[key] ??= message
  }
  return { specs, errors, warnings }
}

// specs đã lưu → giá trị ô trên form (giống <input>: chuỗi; ô chọn nhiều: mảng).
export function specsToForm(categorySlug, specs = {}) {
  const form = {}
  for (const field of specFieldsFor(categorySlug)) {
    const value = specs?.[field.key]
    if (value == null) form[field.key] = field.type === 'multi' ? [] : ''
    else if (field.type === 'multi') form[field.key] = Array.isArray(value) ? value : [value]
    else form[field.key] = String(value)
  }
  return form
}
