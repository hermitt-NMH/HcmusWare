// Logic của trang Build PC (ngoài bộ quy tắc trong compatibility.js), dạng HÀM THUẦN để test.
// Xem mục "Lọc linh kiện trong Builder" trong docs/quy-tac-tuong-thich.md.

// 8 dòng của Builder theo đúng thứ tự lắp. VGA không bắt buộc khi CPU có iGPU (R9).
export const BUILDER_SLOTS = [
  { slug: 'cpu', label: 'CPU' },
  { slug: 'mainboard', label: 'Mainboard' },
  { slug: 'ram', label: 'RAM' },
  { slug: 'vga', label: 'VGA', optional: true },
  { slug: 'ssd', label: 'SSD' },
  { slug: 'psu', label: 'Nguồn (PSU)' },
  { slug: 'case', label: 'Vỏ máy (Case)' },
  { slug: 'cooler', label: 'Tản nhiệt' },
]

export const SLOT_SLUGS = BUILDER_SLOTS.map((s) => s.slug)

// Mua tối đa 2 kit RAM (mainboard phổ thông có 2–4 khe).
export const MAX_RAM_QTY = 2

export const STORAGE_KEY = 'hcmusware.build'

// Linh kiện hợp lệ để chọn cho một dòng, dựa trên các linh kiện đã chọn:
// - đã chọn CPU: mainboard cùng socket (R1), tản nhiệt hỗ trợ socket đó (R7)
// - đã chọn mainboard: RAM đúng chuẩn (R2), case vừa kích thước (R5)
// Thông số chưa có (null) thì không loại – quy tắc W5 sẽ cảnh báo sau khi chọn.
// Trả về { items, filters } – filters là mô tả các điều kiện đang áp dụng để hiện cho khách.
export function filterCandidates(slug, products, build = {}) {
  const cpuS = build.cpu?.specs ?? {}
  const mbS = build.mainboard?.specs ?? {}
  const checks = []

  if (slug === 'mainboard' && cpuS.socket) {
    checks.push({
      label: `Socket ${cpuS.socket} (theo CPU)`,
      ok: (s) => s.socket == null || s.socket === cpuS.socket,
    })
  }
  if (slug === 'cooler' && cpuS.socket) {
    checks.push({
      label: `Hỗ trợ socket ${cpuS.socket} (theo CPU)`,
      ok: (s) => !Array.isArray(s.sockets) || s.sockets.includes(cpuS.socket),
    })
  }
  if (slug === 'ram' && mbS.ram_type) {
    checks.push({
      label: `${mbS.ram_type} (theo mainboard)`,
      ok: (s) => s.ram_type == null || s.ram_type === mbS.ram_type,
    })
  }
  if (slug === 'case' && mbS.form_factor) {
    checks.push({
      label: `Vừa mainboard ${mbS.form_factor}`,
      ok: (s) => !Array.isArray(s.form_factors) || s.form_factors.includes(mbS.form_factor),
    })
  }

  const items = products.filter(
    (p) => p.categories?.slug === slug && checks.every((c) => c.ok(p.specs ?? {})),
  )
  return { items, filters: checks.map((c) => c.label) }
}

// Gom sản phẩm theo danh mục: { cpu: [...], mainboard: [...] }.
export function groupBySlug(products) {
  const groups = Object.fromEntries(SLOT_SLUGS.map((s) => [s, []]))
  for (const p of products) {
    const slug = p.categories?.slug
    if (groups[slug]) groups[slug].push(p)
  }
  return groups
}

// Số lượng của từng linh kiện khi mua: RAM theo số kit, còn lại 1.
export function partQty(slug, ramQty) {
  return slug === 'ram' ? ramQty : 1
}

// Tổng tiền cấu hình (RAM × số kit). Linh kiện chưa có giá thì không cộng.
export function buildTotalPrice(build, ramQty = 1) {
  return SLOT_SLUGS.reduce((sum, slug) => {
    const p = build[slug]
    return p?.price != null ? sum + p.price * partQty(slug, ramQty) : sum
  }, 0)
}

// Linh kiện đã chọn nhưng kho không đủ số lượng cần (vd chọn từ lần trước, nay đã hết hàng).
export function stockProblems(build, ramQty = 1) {
  return SLOT_SLUGS.filter((slug) => {
    const p = build[slug]
    return p && p.stock < partQty(slug, ramQty)
  })
}

// Danh sách để thêm vào giỏ: [{ product, qty }] theo thứ tự Builder.
export function buildToCartEntries(build, ramQty = 1) {
  return SLOT_SLUGS.filter((slug) => build[slug]).map((slug) => ({
    product: build[slug],
    qty: partQty(slug, ramQty),
  }))
}

// Lưu cấu hình vào localStorage chỉ bằng id (thông số/giá lấy lại từ DB khi mở trang).
export function serializeBuild(ids, ramQty) {
  return JSON.stringify({ ids, ramQty })
}

// Đọc cấu hình đã lưu. Dữ liệu hỏng thì trả cấu hình rỗng.
export function parseStoredBuild(raw) {
  const empty = { ids: {}, ramQty: 1 }
  if (!raw) return empty
  let data
  try {
    data = JSON.parse(raw)
  } catch {
    return empty
  }
  if (!data || typeof data !== 'object') return empty
  const ids = {}
  for (const slug of SLOT_SLUGS) {
    const id = data.ids?.[slug]
    if (Number.isSafeInteger(id)) ids[slug] = id
  }
  const ramQty = Number.isInteger(data.ramQty) ? Math.min(Math.max(data.ramQty, 1), MAX_RAM_QTY) : 1
  return { ids, ramQty }
}

// Đổi { cpu: id, ... } thành { cpu: product, ... }. id không còn trên DB thì bỏ qua.
export function resolveBuild(ids, products) {
  const byId = new Map(products.map((p) => [p.id, p]))
  const build = {}
  for (const slug of SLOT_SLUGS) {
    const p = byId.get(ids[slug])
    // Kiểm tra cả danh mục: id cũ có thể đã thành sản phẩm loại khác.
    if (p && p.categories?.slug === slug) build[slug] = p
  }
  return build
}
