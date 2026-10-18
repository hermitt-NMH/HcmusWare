// Lọc ~120 sản phẩm (8 loại × 15) từ PC Part Dataset, đổi giá USD → VNĐ, đẩy lên Supabase.
//
// Cách chạy:
//   1. Tải https://github.com/docyx/pc-part-dataset, chép thư mục data/json vào data/raw/
//      (cần các file cpu.json, motherboard.json, memory.json, video-card.json,
//       internal-hard-drive.json, power-supply.json, case.json, cpu-cooler.json)
//   2. Điền VITE_SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY trong .env.local
//   3. npm run import-data            (thêm --dry-run để chỉ xem kết quả, không đẩy lên)
//
// Chỉ chọn linh kiện đời mới lắp được với nhau (socket AM4/AM5/LGA1700/LGA1851, DDR4/DDR5,
// VGA RTX 30–50 / RX 6000–9000 / Arc) để Builder kiểm tra được tương thích.
// Thông số bộ dữ liệu không có được suy ra từ tên/chipset; giá trị ước lượng được ghi tên
// vào specs.estimated. BA sửa hoặc bổ sung tay trong data/overrides.json:
//   { "AMD Ryzen 5 7600": { "socket": "AM5" }, ... }   (khóa = tên sản phẩm gốc trong bộ dữ liệu)
// Xem quy tắc tương thích tại docs/quy-tac-tuong-thich.md.

import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const RAW_DIR = new URL('../data/raw/', import.meta.url)
const OVERRIDES_FILE = new URL('../data/overrides.json', import.meta.url)
const OUTPUT_FILE = new URL('../data/products.json', import.meta.url)
// Ảnh sản phẩm do scripts/fetch-images.js tải về (tên sản phẩm → image_url)
const IMAGES_FILE = new URL('../data/images.json', import.meta.url)
const PER_CATEGORY = 15
const USD_TO_VND = Number(process.env.USD_TO_VND || 26000)
const DRY_RUN = process.argv.includes('--dry-run')

const SUPPORTED_SOCKETS = ['AM4', 'AM5', 'LGA1700', 'LGA1851']
const BOARD_FORM_FACTORS = ['ATX', 'Micro ATX', 'Mini ITX']

// ---------- Suy luận thông số từ tên ----------

function inferCpuSocket(name) {
  const n = name.toLowerCase()
  if (/threadripper|xeon|epyc/.test(n)) return null
  if (/ryzen \d+ (7|8|9)\d{3}/.test(n)) return 'AM5'
  if (/ryzen \d+ (3|4|5)\d{3}/.test(n)) return 'AM4' // bỏ Ryzen 1000/2000 (2017–2018)
  if (/core ultra \d+ 2\d{2}/.test(n)) return 'LGA1851'
  if (/core i\d-1[234]\d{3}/.test(n)) return 'LGA1700'
  if (/core i\d-1[01]\d{3}/.test(n)) return 'LGA1200'
  return null
}

function inferBoardRamType(name, socket) {
  // Hãng thường thêm "DDR4"/"D4" vào tên bản DDR4 của mainboard LGA1700.
  if (/ddr4|\bd4\b/i.test(name)) return 'DDR4'
  if (/ddr5|\bd5\b/i.test(name)) return 'DDR5'
  if (socket === 'AM5' || socket === 'LGA1851' || socket === 'LGA1700') return 'DDR5'
  if (socket === 'AM4' || socket === 'LGA1200') return 'DDR4'
  return null
}

// Case loại nào thì nhét vừa mainboard cỡ nào.
function caseFormFactors(type = '') {
  const t = type.toLowerCase()
  if (t.includes('mini itx')) return ['Mini ITX']
  if (t.includes('microatx') || t.includes('micro atx')) return ['Micro ATX', 'Mini ITX']
  if (t.includes('full tower')) return ['EATX', 'ATX', 'Micro ATX', 'Mini ITX']
  if (t.includes('atx')) return ['ATX', 'Micro ATX', 'Mini ITX']
  return []
}

// Bộ dữ liệu không có chiều dài VGA tối đa của case → ước lượng theo loại vỏ (BA tự ước lượng, chỉnh trong overrides.json nếu cần).
const CASE_MAX_GPU_MM = {
  'Mini ITX Tower': 320,
  'MicroATX Mini Tower': 330,
  'MicroATX Mid Tower': 350,
  'ATX Mid Tower': 360,
  'ATX Full Tower': 400,
}

// Công suất card (W) theo chipset, lấy theo thông số tham chiếu của NVIDIA/AMD/Intel.
const GPU_TDP_W = {
  'GeForce RTX 3050 6GB': 70,
  'GeForce RTX 3050 8GB': 130,
  'GeForce RTX 3060 8GB': 170,
  'GeForce RTX 3060 12GB': 170,
  'GeForce RTX 3060 Ti': 200,
  'GeForce RTX 3070': 220,
  'GeForce RTX 3070 Ti': 290,
  'GeForce RTX 3080 10GB': 320,
  'GeForce RTX 3080 12GB LHR': 350,
  'GeForce RTX 3080 Ti': 350,
  'GeForce RTX 3090': 350,
  'GeForce RTX 3090 Ti': 450,
  'GeForce RTX 4060': 115,
  'GeForce RTX 4060 Ti': 165,
  'GeForce RTX 4070': 200,
  'GeForce RTX 4070 SUPER': 220,
  'GeForce RTX 4070 Ti': 285,
  'GeForce RTX 4070 Ti SUPER': 285,
  'GeForce RTX 4080': 320,
  'GeForce RTX 4080 SUPER': 320,
  'GeForce RTX 4090': 450,
  'GeForce RTX 5050': 130,
  'GeForce RTX 5060': 145,
  'GeForce RTX 5060 Ti': 180,
  'GeForce RTX 5070': 250,
  'GeForce RTX 5070 Ti': 300,
  'GeForce RTX 5080': 360,
  'GeForce RTX 5090': 575,
  'Radeon RX 6500 XT': 107,
  'Radeon RX 6600': 132,
  'Radeon RX 6600 XT': 160,
  'Radeon RX 6650 XT': 180,
  'Radeon RX 6700 XT': 230,
  'Radeon RX 6750 XT': 250,
  'Radeon RX 6800': 250,
  'Radeon RX 6800 XT': 300,
  'Radeon RX 6900 XT': 300,
  'Radeon RX 6950 XT': 335,
  'Radeon RX 7600': 165,
  'Radeon RX 7600 XT': 190,
  'Radeon RX 7700 XT': 245,
  'Radeon RX 7800 XT': 263,
  'Radeon RX 7900 GRE': 260,
  'Radeon RX 7900 XT': 315,
  'Radeon RX 7900 XTX': 355,
  'Radeon RX 9060 XT': 160,
  'Radeon RX 9070': 220,
  'Radeon RX 9070 XT': 304,
  'Arc A750': 225,
  'Arc A770': 225,
  'Arc B570': 150,
  'Arc B580': 190,
}
// Bản LHR có cùng công suất với bản thường.
const gpuTdp = (chipset = '') =>
  GPU_TDP_W[chipset] ?? GPU_TDP_W[chipset.replace(/ LHR$/, '')] ?? null

// Bộ dữ liệu không có socket tản hỗ trợ; tản đời mới hầu hết hỗ trợ cả 4 socket
// (LGA1851 dùng chung ngàm LGA1700). Noctua đuôi "i" chỉ cho Intel, đuôi "a" chỉ cho AMD.
function coolerSockets(name) {
  if (/Noctua NH-\S+i\b/.test(name) || /Noctua NH-\S+i-/.test(name)) return ['LGA1700', 'LGA1851']
  if (/Noctua NH-\S+a\b/.test(name) || /Noctua NH-\S+a-/.test(name)) return ['AM4', 'AM5']
  return [...SUPPORTED_SOCKETS]
}

// Tên chứa mã linh kiện dài (VCG50608DFXPB1, M386A4G40DM0-CPB...) thường là hàng OEM/server, không nên bán lẻ.
const looksLikePartNumber = (name) => /\b(?=[A-Z0-9-]*\d)[A-Z0-9-]{10,}\b/.test(name)

const MULTI_WORD_BRANDS = [
  'Western Digital',
  'Cooler Master',
  'Lian Li',
  'Fractal Design',
  'be quiet!',
  'Super Flower',
]
const brandOf = (name) =>
  MULTI_WORD_BRANDS.find((b) => name.startsWith(b + ' ')) ?? name.split(' ')[0]
const num = (v) => (v == null || Number.isNaN(Number(v)) ? null : Number(v))
const between = (v, min, max) => v != null && v >= min && v <= max

// ---------- Cấu hình từng loại ----------
// file: tên file trong bộ dữ liệu; usd: khoảng giá USD được chọn; filter: bỏ bản ghi không phù hợp;
// name: tên hiển thị trên web (mặc định = tên gốc); specs: đổi về khóa chung của web.

const CATEGORIES = {
  cpu: {
    file: 'cpu.json',
    usd: [60, 700],
    filter: (p) => SUPPORTED_SOCKETS.includes(inferCpuSocket(p.name)),
    specs: (p) => ({
      socket: inferCpuSocket(p.name),
      tdp_w: num(p.tdp),
      cores: num(p.core_count),
      base_clock_ghz: num(p.core_clock),
      boost_clock_ghz: num(p.boost_clock),
      igpu: Boolean(p.graphics),
    }),
  },
  mainboard: {
    file: 'motherboard.json',
    usd: [70, 500],
    filter: (p) =>
      SUPPORTED_SOCKETS.includes(p.socket) && BOARD_FORM_FACTORS.includes(p.form_factor),
    specs: (p) => ({
      socket: p.socket,
      ram_type: inferBoardRamType(p.name, p.socket),
      form_factor: p.form_factor,
      ram_slots: num(p.memory_slots),
      max_ram_gb: num(p.max_memory),
    }),
  },
  ram: {
    file: 'memory.json',
    usd: [20, 300],
    filter: (p) =>
      !/\bKSM|ECC|RDIMM|Registered|Server/i.test(p.name) && // RAM server không cắm được mainboard thường
      Array.isArray(p.speed) &&
      [4, 5].includes(p.speed[0]) &&
      Array.isArray(p.modules) &&
      p.modules[0] <= 2 &&
      between(p.modules[0] * p.modules[1], 8, 64),
    // "Corsair Vengeance RGB 32 GB" có nhiều bản tốc độ → ghi rõ kit và bus cho khỏi trùng tên.
    name: (p) => `${p.name} (${p.modules[0]}x${p.modules[1]}GB) DDR${p.speed[0]}-${p.speed[1]}`,
    specs: (p) => ({
      ram_type: `DDR${p.speed[0]}`,
      speed_mhz: p.speed[1],
      modules: p.modules[0],
      capacity_gb: p.modules[0] * p.modules[1],
    }),
  },
  vga: {
    file: 'video-card.json',
    usd: [150, 2000],
    filter: (p) => gpuTdp(p.chipset) != null && p.length != null,
    // Tên gốc thường thiếu chipset ("Gigabyte GAMING OC") → ghép thêm chipset và VRAM.
    name: (p) => {
      const brand = brandOf(p.name)
      const model = p.chipset.replace(/ LHR$/, '').replace(/ \d+GB$/, '')
      const rest = p.name.slice(brand.length).trim()
      const withModel = rest.includes(model) ? `${brand} ${rest}` : `${brand} ${model} ${rest}`
      return `${withModel} ${p.memory}GB`.replace(/\s+/g, ' ')
    },
    specs: (p) => ({
      chipset: p.chipset.replace(/ LHR$/, ''),
      vram_gb: num(p.memory),
      length_mm: num(p.length),
      tdp_w: gpuTdp(p.chipset),
    }),
  },
  ssd: {
    file: 'internal-hard-drive.json',
    usd: [25, 400],
    filter: (p) =>
      p.type === 'SSD' &&
      [
        'M.2 PCIe 3.0 X4',
        'M.2 PCIe 4.0 X4',
        'M.2 PCIe 5.0 X4',
        'M.2 SATA',
        'SATA 6.0 Gb/s',
      ].includes(p.interface) &&
      between(p.capacity, 250, 4000),
    specs: (p) => ({
      capacity_gb: num(p.capacity),
      interface: p.interface,
      form_factor: typeof p.form_factor === 'number' ? `${p.form_factor}"` : p.form_factor,
    }),
  },
  psu: {
    file: 'power-supply.json',
    usd: [35, 350],
    filter: (p) => ['ATX', 'SFX'].includes(p.type) && p.efficiency && between(p.wattage, 450, 1300),
    specs: (p) => ({
      wattage_w: num(p.wattage),
      efficiency:
        p.efficiency === 'plus'
          ? '80+'
          : `80+ ${p.efficiency[0].toUpperCase()}${p.efficiency.slice(1)}`,
      form_factor: p.type,
      modular: p.modular === true ? 'Full' : p.modular || 'No',
    }),
  },
  case: {
    file: 'case.json',
    usd: [35, 300],
    filter: (p) => p.type in CASE_MAX_GPU_MM,
    specs: (p) => ({
      case_type: p.type,
      form_factors: caseFormFactors(p.type),
      max_gpu_length_mm: CASE_MAX_GPU_MM[p.type],
      estimated: ['max_gpu_length_mm'],
    }),
  },
  cooler: {
    file: 'cpu-cooler.json',
    usd: [15, 250],
    // Bỏ tản chuyên cho socket máy trạm/server (LGA2066, TR4, Dynatron...).
    filter: (p) => !/BXTS13X|2066|TR4|sTR|Dynatron/i.test(p.name),
    specs: (p) => ({
      cooler_type: p.size ? 'liquid' : 'air',
      ...(p.size ? { radiator_mm: num(p.size) } : {}), // tản khí không có két nước
      sockets: coolerSockets(p.name),
      estimated: ['sockets'],
    }),
  },
}

// Lấy n phần tử trải đều theo giá, để có cả hàng rẻ lẫn hàng cao cấp.
function pickSpread(items, n) {
  const sorted = [...items].sort((a, b) => a.price - b.price)
  if (sorted.length <= n) return sorted
  const step = (sorted.length - 1) / (n - 1)
  return Array.from({ length: n }, (_, i) => sorted[Math.round(i * step)])
}

// 129.99 USD → 3.380.000 VNĐ (làm tròn đến 10.000đ)
const toVnd = (usd) => Math.round((usd * USD_TO_VND) / 10000) * 10000

// Tồn kho giả lập 5–30, cố định theo tên để chạy lại script không bị đổi số.
const fakeStock = (name) =>
  5 + ([...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 26)

async function readJson(url) {
  return JSON.parse(await readFile(url, 'utf8'))
}

async function buildProducts() {
  const overrides = existsSync(OVERRIDES_FILE) ? await readJson(OVERRIDES_FILE) : {}
  const images = existsSync(IMAGES_FILE) ? await readJson(IMAGES_FILE) : {}
  const result = []

  for (const [slug, cfg] of Object.entries(CATEGORIES)) {
    const fileUrl = new URL(cfg.file, RAW_DIR)
    if (!existsSync(fileUrl)) {
      throw new Error(`Thiếu file data/raw/${cfg.file} – xem hướng dẫn đầu file script.`)
    }
    const raw = await readJson(fileUrl)
    const displayName = (p) => (cfg.name ? cfg.name(p) : p.name)

    // Lọc theo giá + điều kiện, bỏ bản ghi trùng tên hiển thị (DB yêu cầu tên duy nhất trong danh mục).
    const seen = new Set()
    const candidates = raw.filter((p) => {
      if (!between(p.price, ...cfg.usd) || looksLikePartNumber(p.name)) return false
      if (cfg.filter && !cfg.filter(p)) return false
      const name = displayName(p)
      if (seen.has(name)) return false
      seen.add(name)
      return true
    })

    // Ưu tiên sản phẩm BA đã chọn trong overrides.json, phần còn lại chọn tự động.
    const chosen = candidates.filter((p) => overrides[p.name])
    const rest = pickSpread(
      candidates.filter((p) => !overrides[p.name]),
      Math.max(PER_CATEGORY - chosen.length, 0),
    )

    for (const p of [...chosen, ...rest].slice(0, PER_CATEGORY)) {
      const { brand, ...specOverrides } = overrides[p.name] ?? {}
      const name = displayName(p)
      const specs = { ...cfg.specs(p), ...specOverrides }
      // Trường BA đã điền tay thì không còn là ước lượng.
      if (specs.estimated) {
        specs.estimated = specs.estimated.filter((k) => !(k in specOverrides))
        if (!specs.estimated.length) delete specs.estimated
      }
      result.push({
        slug,
        name,
        brand: brand ?? brandOf(p.name),
        price: toVnd(p.price),
        stock: fakeStock(name),
        image_url: images[name]?.image_url ?? null,
        specs,
      })
    }
  }
  return result
}

// Đếm số sản phẩm còn thiếu / đang ước lượng từng thông số để BA biết cần bổ sung gì.
function reportMissing(products) {
  const missing = {}
  const estimated = {}
  for (const p of products) {
    for (const [key, value] of Object.entries(p.specs)) {
      if (value == null || (Array.isArray(value) && value.length === 0)) {
        const k = `${p.slug}.${key}`
        missing[k] = (missing[k] ?? 0) + 1
      }
    }
    for (const key of p.specs.estimated ?? []) {
      const k = `${p.slug}.${key}`
      estimated[k] = (estimated[k] ?? 0) + 1
    }
  }
  const print = (title, counts) => {
    const rows = Object.entries(counts)
    if (!rows.length) return
    console.log(`\n${title}`)
    for (const [k, count] of rows) console.log(`  ${k}: ${count} sản phẩm`)
  }
  print('Thông số còn thiếu (BA bổ sung trong data/overrides.json):', missing)
  print('Thông số đang ước lượng (BA tự ước lượng, chỉnh trong overrides.json nếu cần):', estimated)
}

async function upload(products) {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key)
    throw new Error('Thiếu VITE_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong .env.local')

  const supabase = createClient(url, key, { auth: { persistSession: false } })
  const { data: categories, error } = await supabase.from('categories').select('id, slug')
  if (error) throw error
  const idBySlug = Object.fromEntries(categories.map((c) => [c.slug, c.id]))

  const rows = products.map(({ slug, ...p }) => {
    if (!idBySlug[slug])
      throw new Error(`Chưa có danh mục "${slug}" – hãy chạy supabase/seed.sql trước.`)
    return { ...p, category_id: idBySlug[slug] }
  })

  const { error: upsertError } = await supabase
    .from('products')
    .upsert(rows, { onConflict: 'category_id,name' })
  if (upsertError) throw upsertError
}

async function main() {
  const products = await buildProducts()
  await writeFile(OUTPUT_FILE, JSON.stringify(products, null, 2) + '\n')
  console.log(`Đã chọn ${products.length} sản phẩm → data/products.json (tỷ giá ${USD_TO_VND})`)
  reportMissing(products)

  if (DRY_RUN) return console.log('\n--dry-run: không đẩy lên Supabase.')
  await upload(products)
  console.log('\nĐã đẩy dữ liệu lên Supabase.')
}

main().catch((err) => {
  console.error('Lỗi:', err.message)
  process.exit(1)
})
