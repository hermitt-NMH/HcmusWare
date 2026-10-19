// Bộ quy tắc tương thích cho Build PC – xem docs/quy-tac-tuong-thich.md (R1–R9, W1–W5).
// Đây là HÀM THUẦN: không gọi mạng, không đọc state React → dễ viết unit test.
// Mỗi linh kiện là một dòng của bảng products (dùng product.specs); chưa chọn thì là null.

// Linh kiện bắt buộc để cấu hình "đủ". VGA chỉ bắt buộc khi CPU không có iGPU (R9).
const REQUIRED_PARTS = ['cpu', 'mainboard', 'ram', 'ssd', 'psu', 'case', 'cooler']

// Tên tiếng Việt của thông số, dùng trong thông báo W5.
const SPEC_LABELS = {
  socket: 'socket',
  ram_type: 'chuẩn RAM',
  modules: 'số thanh RAM',
  ram_slots: 'số khe RAM',
  capacity_gb: 'dung lượng',
  max_ram_gb: 'RAM tối đa',
  form_factor: 'kích thước',
  form_factors: 'kích thước mainboard hỗ trợ',
  length_mm: 'chiều dài',
  max_gpu_length_mm: 'chiều dài VGA tối đa',
  sockets: 'socket hỗ trợ',
  tdp_w: 'công suất (TDP)',
  wattage_w: 'công suất',
}

// Mỗi quy tắc R1–R8: cần chọn những linh kiện nào (parts) và dùng thông số nào (specs: [linh kiện, trường]).
// Dùng để kiểm tra W5 (thông số thiếu hoặc đang ước lượng).
// R8: VGA không bắt buộc, nhưng nếu đã chọn VGA thì tdp_w của nó cũng được kiểm tra.
const RULE_SPECS = [
  {
    parts: ['cpu', 'mainboard'],
    specs: [
      ['cpu', 'socket'],
      ['mainboard', 'socket'],
    ],
  },
  {
    parts: ['ram', 'mainboard'],
    specs: [
      ['ram', 'ram_type'],
      ['mainboard', 'ram_type'],
    ],
  },
  {
    parts: ['ram', 'mainboard'],
    specs: [
      ['ram', 'modules'],
      ['mainboard', 'ram_slots'],
    ],
  },
  {
    parts: ['ram', 'mainboard'],
    specs: [
      ['ram', 'capacity_gb'],
      ['mainboard', 'max_ram_gb'],
    ],
  },
  {
    parts: ['mainboard', 'case'],
    specs: [
      ['mainboard', 'form_factor'],
      ['case', 'form_factors'],
    ],
  },
  {
    parts: ['vga', 'case'],
    specs: [
      ['vga', 'length_mm'],
      ['case', 'max_gpu_length_mm'],
    ],
  },
  {
    parts: ['cpu', 'cooler'],
    specs: [
      ['cpu', 'socket'],
      ['cooler', 'sockets'],
    ],
  },
  {
    parts: ['cpu', 'psu'],
    specs: [
      ['cpu', 'tdp_w'],
      ['vga', 'tdp_w'],
      ['psu', 'wattage_w'],
    ],
  },
]

// Công suất ước tính: CPU + VGA + 100 W (mainboard, RAM, SSD, quạt).
export function calcTotalPowerW(cpu, vga) {
  return (cpu?.specs?.tdp_w ?? 0) + (vga?.specs?.tdp_w ?? 0) + 100
}

// PSU đề xuất: tổng × 1,3 rồi làm tròn LÊN bội số 50. Vd 280 → 364 → 400.
export function calcRecommendedPsuW(totalPowerW) {
  // Math.round trước để tránh sai số số thực (vd 250 × 1.3 = 325.00000000000006 → 350 sai).
  const withMargin = Math.round(totalPowerW * 1.3 * 100) / 100
  return Math.ceil(withMargin / 50) * 50
}

export function checkCompatibility(build = {}) {
  const { cpu, vga } = build
  const pcCase = build.case // "case" là từ khóa của JS nên đặt tên khác cho dễ đọc
  const ramQty = build.ramQty ?? 1

  const errors = []
  const warnings = []
  const addError = (rule, message, parts) => errors.push({ rule, message, parts })
  const addWarning = (rule, message, parts) => warnings.push({ rule, message, parts })

  // Lấy specs của một linh kiện (chưa chọn → object rỗng).
  const s = (part) => build[part]?.specs ?? {}
  // Một quy tắc chỉ chạy khi đã chọn đủ linh kiện nó cần.
  const has = (...parts) => parts.every((p) => build[p])
  // Thông số có giá trị (không null/undefined) thì mới so sánh, thiếu thì bỏ qua (W5 sẽ báo).
  const known = (...values) => values.every((v) => v != null)

  const cpuS = s('cpu')
  const mbS = s('mainboard')
  const ramS = s('ram')
  const vgaS = s('vga')
  const psuS = s('psu')
  const caseS = s('case')
  const coolerS = s('cooler')

  // Chưa chọn gì thì chưa tính công suất.
  const anySelected = ['cpu', 'mainboard', 'ram', 'vga', 'ssd', 'psu', 'case', 'cooler'].some(
    (p) => build[p],
  )
  const totalPowerW = anySelected ? calcTotalPowerW(cpu, vga) : 0
  const recommendedPsuW = anySelected ? calcRecommendedPsuW(totalPowerW) : 0

  // ---------- Quy tắc lỗi ----------

  // R1: socket CPU = socket mainboard
  if (has('cpu', 'mainboard') && known(cpuS.socket, mbS.socket) && cpuS.socket !== mbS.socket) {
    addError('R1', `CPU socket ${cpuS.socket} không lắp được mainboard socket ${mbS.socket}`, [
      'cpu',
      'mainboard',
    ])
  }

  // R2: chuẩn RAM = chuẩn mainboard hỗ trợ
  if (
    has('ram', 'mainboard') &&
    known(ramS.ram_type, mbS.ram_type) &&
    ramS.ram_type !== mbS.ram_type
  ) {
    addError('R2', `Mainboard chỉ nhận ${mbS.ram_type}, RAM đang chọn là ${ramS.ram_type}`, [
      'ram',
      'mainboard',
    ])
  }

  // R3: tổng số thanh RAM ≤ số khe
  if (has('ram', 'mainboard') && known(ramS.modules, mbS.ram_slots)) {
    const need = ramS.modules * ramQty
    if (need > mbS.ram_slots) {
      addError('R3', `Cần ${need} khe RAM nhưng mainboard chỉ có ${mbS.ram_slots} khe`, [
        'ram',
        'mainboard',
      ])
    }
  }

  // R4: tổng dung lượng RAM ≤ mức tối đa của mainboard
  if (has('ram', 'mainboard') && known(ramS.capacity_gb, mbS.max_ram_gb)) {
    const total = ramS.capacity_gb * ramQty
    if (total > mbS.max_ram_gb) {
      addError('R4', `Tổng ${total} GB vượt mức tối đa ${mbS.max_ram_gb} GB của mainboard`, [
        'ram',
        'mainboard',
      ])
    }
  }

  // R5: case hỗ trợ kích thước mainboard
  if (
    has('mainboard', 'case') &&
    known(mbS.form_factor, caseS.form_factors) &&
    !caseS.form_factors.includes(mbS.form_factor)
  ) {
    addError(
      'R5',
      `Case ${caseS.case_type ?? pcCase.name} không vừa mainboard ${mbS.form_factor}`,
      ['mainboard', 'case'],
    )
  }

  // R6: VGA không dài hơn mức case chứa được (bằng nhau vẫn hợp lệ)
  if (
    has('vga', 'case') &&
    known(vgaS.length_mm, caseS.max_gpu_length_mm) &&
    vgaS.length_mm > caseS.max_gpu_length_mm
  ) {
    addError(
      'R6',
      `VGA dài ${vgaS.length_mm} mm, case chỉ chứa tối đa ${caseS.max_gpu_length_mm} mm`,
      ['vga', 'case'],
    )
  }

  // R7: tản nhiệt hỗ trợ socket CPU
  if (
    has('cpu', 'cooler') &&
    known(cpuS.socket, coolerS.sockets) &&
    !coolerS.sockets.includes(cpuS.socket)
  ) {
    addError('R7', `Tản nhiệt không hỗ trợ socket ${cpuS.socket}`, ['cpu', 'cooler'])
  }

  // R8 + W1: công suất nguồn. Cần CPU và PSU (VGA không bắt buộc).
  if (has('cpu', 'psu') && known(cpuS.tdp_w, psuS.wattage_w)) {
    if (psuS.wattage_w < totalPowerW) {
      addError('R8', `Nguồn ${psuS.wattage_w} W không đủ, cấu hình cần khoảng ${totalPowerW} W`, [
        'psu',
      ])
    } else if (psuS.wattage_w < recommendedPsuW) {
      addWarning('W1', `Nguồn đủ nhưng sát mức, nên chọn từ ${recommendedPsuW} W`, ['psu'])
    }
  }

  // R9: CPU không có iGPU thì phải có VGA
  if (cpu && cpuS.igpu === false && !vga) {
    addError('R9', 'CPU không có nhân đồ họa, cần chọn VGA để xuất hình', ['cpu', 'vga'])
  }

  // ---------- Quy tắc cảnh báo ----------
  const caseType = caseS.case_type ?? ''

  // W2: nguồn SFX trong case không phải Mini ITX
  if (has('psu', 'case') && psuS.form_factor === 'SFX' && !caseType.startsWith('Mini ITX')) {
    addWarning('W2', 'Nguồn SFX cần thêm bracket chuyển sang ATX', ['psu', 'case'])
  }

  // W3: nguồn ATX trong case Mini ITX Tower
  if (has('psu', 'case') && psuS.form_factor === 'ATX' && caseType === 'Mini ITX Tower') {
    addWarning('W3', 'Kiểm tra case có hỗ trợ nguồn ATX không', ['psu', 'case'])
  }

  // W4: két nước 360 mm trong case nhỏ
  if (
    has('cooler', 'case') &&
    coolerS.radiator_mm >= 360 &&
    (caseType.startsWith('MicroATX') || caseType.startsWith('Mini ITX'))
  ) {
    addWarning('W4', `Kiểm tra case có chỗ lắp két nước ${coolerS.radiator_mm} mm không`, [
      'cooler',
      'case',
    ])
  }

  // W5: thông số cần cho R1–R8 bị thiếu hoặc đang ước lượng.
  // Chỉ xét quy tắc đã chọn đủ linh kiện; mỗi (linh kiện, thông số) báo một lần.
  const seen = new Set()
  for (const { parts, specs } of RULE_SPECS) {
    if (!has(...parts)) continue

    for (const [part, field] of specs) {
      if (!build[part]) continue // VGA của R8 chưa chọn thì bỏ qua
      const key = `${part}.${field}`
      if (seen.has(key)) continue
      const partSpecs = s(part)
      const missing = partSpecs[field] == null
      const estimated = Array.isArray(partSpecs.estimated) && partSpecs.estimated.includes(field)
      if (missing || estimated) {
        seen.add(key)
        const label = SPEC_LABELS[field] ?? field
        addWarning(
          'W5',
          `Thông số ${label} của ${build[part].name ?? part} ${missing ? 'chưa có' : 'là ước lượng'}, hãy kiểm tra trang hãng`,
          [part],
        )
      }
    }
  }

  // ---------- Đủ cấu hình ----------
  const needVga = cpuS.igpu === false
  const complete = REQUIRED_PARTS.every((p) => build[p]) && (!needVga || Boolean(vga))

  return { errors, warnings, totalPowerW, recommendedPsuW, complete }
}
