// F10 – Gợi ý cấu hình theo ngân sách (Giai đoạn 2). HÀM THUẦN: không gọi mạng, không đọc state React.
// Vào: danh sách sản phẩm (cùng dạng Builder dùng: specs, price, stock, categories.slug),
//      ngân sách (VNĐ) và nhu cầu (gaming / design / office).
// Ra: 2–3 cấu hình HỢP LỆ theo compatibility.js (không lỗi R1–R9, đủ linh kiện), tổng tiền ≤ ngân sách,
//     để khách so sánh rồi mở trong Builder (toBuilderState).
//
// Cách làm: thử mọi cặp CPU × VGA còn hàng (15 × 16 ≈ 240 cặp), mỗi cặp lắp phần còn lại bằng linh kiện
// RẺ NHẤT vẫn hợp lệ và đạt mức tối thiểu của nhu cầu (RAM, SSD), rồi chấm điểm CPU/VGA theo nhu cầu.
// Chọn cấu hình điểm cao nhất ở 3 mức giá: ≤ 100%, ≤ 85%, ≤ 70% ngân sách.

import { checkCompatibility, calcRecommendedPsuW, calcTotalPowerW } from './compatibility'
import { buildTotalPrice, groupBySlug, SLOT_SLUGS } from './builder'

export const PURPOSES = {
  gaming: {
    label: 'Chơi game',
    needVga: true,
    cpuWeight: 0.35,
    gpuWeight: 0.65,
    minRamGb: 16,
    maxRamGb: 32,
    minSsdGb: 500,
  },
  design: {
    label: 'Đồ họa',
    needVga: true,
    cpuWeight: 0.5,
    gpuWeight: 0.5,
    minRamGb: 32,
    maxRamGb: 64,
    minSsdGb: 1000,
  },
  office: {
    label: 'Văn phòng',
    needVga: false,
    cpuWeight: 1,
    gpuWeight: 0,
    minRamGb: 8,
    maxRamGb: 16,
    minSsdGb: 250,
  },
}

// Ngân sách nhập vào phải nằm trong khoảng này (VNĐ).
export const MIN_BUDGET = 1_000_000
export const MAX_BUDGET = 500_000_000

// 3 mức giá so với ngân sách, theo thứ tự hiển thị.
export const TIERS = [
  { key: 'best', label: 'Mạnh nhất trong ngân sách', ratio: 1 },
  { key: 'balanced', label: 'Cân bằng', ratio: 0.85 },
  { key: 'saving', label: 'Tiết kiệm', ratio: 0.7 },
]

// Hiệu năng game TƯƠNG ĐỐI của chip VGA (RTX 4060 = 100), ước lượng từ các bài so sánh công khai
// ở 1080p/1440p. Chỉ dùng để XẾP HẠNG khi gợi ý, không hiển thị như số đo.
// Tuần 3: thay bằng bảng điểm BA thu thập cho F09 (có ghi nguồn).
export const GPU_PERF = {
  'RX 6500 XT': 45,
  'RTX 3060': 80,
  'RX 6600 XT': 92,
  'RTX 4060': 100,
  'RTX 4060 Ti': 120,
  'RTX 5060': 120,
  'RTX 3080': 160,
  'RTX 5070': 170,
  'RTX 3080 Ti': 175,
  'RX 7900 XT': 200,
  'RTX 5070 Ti': 205,
  'RX 9070 XT': 210,
  'RTX 5080': 240,
}

// "GeForce RTX 3060 12GB" → "RTX 3060"
export function chipKey(chipset = '') {
  return chipset
    .replace(/^(GeForce|Radeon)\s+/i, '')
    .replace(/\s+\d+\s*GB$/i, '')
    .trim()
}

// Chip chưa có trong bảng: ước theo công suất (card mạnh hơn thường ăn điện nhiều hơn) – rất thô.
export function gpuScore(vga) {
  if (!vga) return 0
  return GPU_PERF[chipKey(vga.specs?.chipset)] ?? (vga.specs?.tdp_w ?? 0) * 0.6
}

// Điểm CPU theo nhu cầu: game ít khi dùng quá 8 nhân, đồ họa tận dụng hết nhân,
// văn phòng chủ yếu cần xung nhịp đơn nhân.
export function cpuScore(cpu, purpose) {
  const s = cpu?.specs ?? {}
  const clock = s.boost_clock_ghz ?? s.base_clock_ghz ?? 0
  const cores = s.cores ?? 0
  if (purpose === 'design') return clock * cores
  if (purpose === 'office') return clock * Math.min(cores, 4)
  return clock * Math.min(cores, 8)
}

const cheapestFirst = (a, b) => a.price - b.price || a.id - b.id
const cheapest = (list, ok = () => true) => [...list].sort(cheapestFirst).find(ok) ?? null

// Lắp đủ cấu hình quanh một cặp CPU + VGA bằng linh kiện rẻ nhất vẫn hợp lệ. Không lắp được → null.
export function completeBuild(cpu, vga, groups, purpose) {
  const need = PURPOSES[purpose]
  const cpuS = cpu.specs ?? {}

  const mainboard = cheapest(groups.mainboard, (m) => m.specs?.socket === cpuS.socket)
  if (!mainboard) return null
  const mbS = mainboard.specs ?? {}

  // RAM: đúng chuẩn, đủ khe, không vượt dung lượng tối đa (R2–R4 với 1 kit).
  const ramOk = (r) =>
    r.specs?.ram_type === mbS.ram_type &&
    (r.specs?.modules ?? 1) <= (mbS.ram_slots ?? Infinity) &&
    (r.specs?.capacity_gb ?? 0) <= (mbS.max_ram_gb ?? Infinity)
  const ram =
    cheapest(groups.ram, (r) => ramOk(r) && (r.specs?.capacity_gb ?? 0) >= need.minRamGb) ??
    cheapest(groups.ram, ramOk)
  if (!ram) return null

  const ssd =
    cheapest(groups.ssd, (s) => (s.specs?.capacity_gb ?? 0) >= need.minSsdGb) ??
    cheapest(groups.ssd)
  if (!ssd) return null

  // Case vừa mainboard (R5) và đủ dài cho VGA (R6).
  const pcCase = cheapest(
    groups.case,
    (c) =>
      Array.isArray(c.specs?.form_factors) &&
      c.specs.form_factors.includes(mbS.form_factor) &&
      (!vga || (c.specs?.max_gpu_length_mm ?? 0) >= (vga.specs?.length_mm ?? 0)),
  )
  if (!pcCase) return null

  // Tản hỗ trợ socket (R7); có số max_tdp_w thì phải đủ cho CPU.
  const cooler = cheapest(
    groups.cooler,
    (c) =>
      Array.isArray(c.specs?.sockets) &&
      c.specs.sockets.includes(cpuS.socket) &&
      (c.specs?.max_tdp_w == null || c.specs.max_tdp_w >= (cpuS.tdp_w ?? 0)),
  )
  if (!cooler) return null

  // Nguồn đạt mức đề xuất (không dính cảnh báo W1); SFX chỉ dùng cho case Mini ITX (tránh W2).
  const minPsuW = calcRecommendedPsuW(calcTotalPowerW(cpu, vga))
  const miniItx = (pcCase.specs?.case_type ?? '').startsWith('Mini ITX')
  const psu = cheapest(
    groups.psu,
    (p) => (p.specs?.wattage_w ?? 0) >= minPsuW && (p.specs?.form_factor !== 'SFX' || miniItx),
  )
  if (!psu) return null

  const build = { cpu, mainboard, ram, ssd, psu, case: pcCase, cooler }
  if (vga) build.vga = vga
  return build
}

// Gợi ý 2–3 cấu hình. Trả { builds, minTotal }:
// - builds: [{ tier, label, parts, ramQty, total, score, warnings }], theo thứ tự TIERS
// - minTotal: giá cấu hình hợp lệ rẻ nhất cho nhu cầu này (để báo "cần ít nhất ..." khi không đủ tiền)
export function suggestBuilds(products, { budget, purpose = 'gaming' } = {}) {
  const need = PURPOSES[purpose]
  if (!need) throw new Error(`Nhu cầu không hợp lệ: ${purpose}`)
  if (!Number.isFinite(budget) || budget < MIN_BUDGET || budget > MAX_BUDGET) {
    throw new Error('Ngân sách phải từ 1 triệu đến 500 triệu đồng')
  }

  // Chỉ dùng sản phẩm còn hàng, có giá.
  const groups = groupBySlug(products.filter((p) => p.stock > 0 && p.price > 0))

  const maxCpu = Math.max(1, ...groups.cpu.map((c) => cpuScore(c, purpose)))
  const maxGpu = Math.max(1, ...groups.vga.map(gpuScore))

  const candidates = []
  for (const cpu of groups.cpu) {
    // Văn phòng: CPU có iGPU thì không cần VGA rời; CPU không có iGPU thì bắt buộc VGA (R9).
    const vgaOptions = [...groups.vga]
    if (!need.needVga && cpu.specs?.igpu !== false) vgaOptions.unshift(null)

    for (const vga of vgaOptions) {
      const parts = completeBuild(cpu, vga, groups, purpose)
      if (!parts) continue
      const check = checkCompatibility({ ...parts, ramQty: 1 })
      if (check.errors.length || !check.complete) continue

      const score =
        need.cpuWeight * (cpuScore(cpu, purpose) / maxCpu) +
        need.gpuWeight * (gpuScore(vga) / maxGpu)
      candidates.push({
        parts,
        ramQty: 1,
        total: buildTotalPrice(parts, 1),
        score: Math.round(score * 1000) / 1000,
        warnings: check.warnings,
      })
    }
  }

  const minTotal = candidates.length ? Math.min(...candidates.map((c) => c.total)) : null

  // Mỗi mức giá lấy cấu hình điểm cao nhất (bằng điểm thì rẻ hơn). Mức sau phải RẺ HƠN và YẾU HƠN
  // mức trước, nếu không thì bỏ (tránh gợi ý "Tiết kiệm" mà đắt hơn "Cân bằng").
  const better = (a, b) => b.score - a.score || a.total - b.total
  const builds = []
  for (const tier of TIERS) {
    const prev = builds[builds.length - 1]
    const limit = Math.min(budget * tier.ratio, prev ? prev.total - 1 : Infinity)
    const pick = candidates
      .filter((c) => c.total <= limit && (!prev || c.score < prev.score))
      .sort(better)[0]
    if (!pick) continue
    builds.push({ tier: tier.key, label: tier.label, ...upgradeExtras(pick, limit, groups, need) })
  }

  return { builds, minTotal }
}

// Còn dư tiền trong mức giá thì nâng RAM (tới maxRamGb của nhu cầu) rồi SSD lên dung lượng lớn hơn
// (vẫn hợp lệ, không vượt limit).
// Chỉ nâng dung lượng, không đổi CPU/VGA nên điểm giữ nguyên.
export function upgradeExtras(candidate, limit, groups, need = PURPOSES.gaming) {
  let { parts, total } = candidate
  for (const slug of ['ram', 'ssd']) {
    const current = parts[slug]
    const options = groups[slug]
      .filter(
        (p) =>
          (p.specs?.capacity_gb ?? 0) > (current.specs?.capacity_gb ?? 0) &&
          (slug !== 'ram' || p.specs.capacity_gb <= need.maxRamGb),
      )
      .sort((a, b) => b.specs.capacity_gb - a.specs.capacity_gb || cheapestFirst(a, b))
    for (const option of options) {
      const newTotal = total - current.price + option.price
      if (newTotal > limit) continue
      const next = { ...parts, [slug]: option }
      if (checkCompatibility({ ...next, ramQty: 1 }).errors.length) continue
      parts = next
      total = newTotal
      break
    }
  }
  if (parts === candidate.parts) return candidate
  return {
    ...candidate,
    parts,
    total,
    warnings: checkCompatibility({ ...parts, ramQty: 1 }).warnings,
  }
}

// Đổi một gợi ý thành dạng Builder lưu ({ ids, ramQty }, xem serializeBuild trong builder.js)
// để nút "Mở trong Builder" (Tuần 2) ghi vào localStorage rồi chuyển sang /build-pc.
export function toBuilderState(suggestion) {
  const ids = {}
  for (const slug of SLOT_SLUGS) {
    if (suggestion.parts[slug]) ids[slug] = suggestion.parts[slug].id
  }
  return { ids, ramQty: suggestion.ramQty }
}
