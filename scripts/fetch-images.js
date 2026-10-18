// Tải ảnh thật cho từng sản phẩm (data/products.json + sản phẩm mẫu trong supabase/seed.sql).
// Ảnh lấy từ kết quả Bing Images theo tên sản phẩm, cắt viền trắng, đưa về khung vuông 600px,
// lưu WebP vào public/images/products/ và ghi bảng tên → đường dẫn vào data/images.json.
// import-dataset.js đọc data/images.json để điền cột image_url.
//
// Cách chạy:
//   npm run fetch-images                      tải ảnh cho sản phẩm chưa có ảnh
//   npm run fetch-images -- --redo "Tên SP"   ảnh bị sai: bỏ ảnh cũ, lấy kết quả tiếp theo
//   npm run fetch-images -- --redo "Tên SP" --query "từ khóa"   tìm bằng từ khóa tự đặt
//   npm run fetch-images -- --sheet          tạo data/images-preview.html để soát ảnh bằng mắt
//
// Ảnh sai mà --redo vẫn không ra: tự tải ảnh khác, đặt vào public/images/products/
// rồi sửa đường dẫn trong data/images.json (đặt "locked": true để script không ghi đè).

import { readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import sharp from 'sharp'

const ROOT = new URL('../', import.meta.url)
const PRODUCTS_FILE = new URL('data/products.json', ROOT)
const SEED_FILE = new URL('supabase/seed.sql', ROOT)
const MAP_FILE = new URL('data/images.json', ROOT)
const SHEET_FILE = new URL('data/images-preview.html', ROOT)
const OUT_DIR = new URL('public/images/products/', ROOT)
const PUBLIC_PREFIX = '/images/products/'

const SIZE = 600
const CONCURRENCY = 4
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'

// Thêm từ khóa theo loại để tên mơ hồ (vd. "Thermaltake Smart") không ra nhầm sản phẩm khác.
const QUERY_HINT = {
  cpu: 'CPU processor',
  mainboard: 'motherboard',
  ram: 'RAM memory kit',
  vga: 'graphics card',
  ssd: 'SSD',
  psu: 'power supply PSU',
  case: 'PC case',
  cooler: 'CPU cooler',
}

// Nguồn hay trả về ảnh không phải ảnh sản phẩm (thumbnail video, ảnh chụp màn hình bài viết...).
const BLOCKED_HOSTS = /ytimg|youtube|pinterest|pinimg|reddit|redd\.it|facebook|fbcdn|tiktok|twimg|wikipedia/

const args = process.argv.slice(2)
const redoName = args.includes('--redo') ? args[args.indexOf('--redo') + 1] : null
const customQuery = args.includes('--query') ? args[args.indexOf('--query') + 1] : null

const slugify = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

async function loadProducts() {
  const products = JSON.parse(await readFile(PRODUCTS_FILE, 'utf8')).map(({ slug, name }) => ({
    slug,
    name,
  }))
  // Sản phẩm mẫu trong seed.sql: các dòng ('slug', 'Tên', 'Hãng', giá, ...)
  const seed = await readFile(SEED_FILE, 'utf8')
  for (const m of seed.matchAll(/^\s*\('([a-z]+)',\s*'([^']+)',\s*'[^']*',\s*\d+/gm)) {
    if (!products.some((p) => p.name === m[2])) products.push({ slug: m[1], name: m[2] })
  }
  return products
}

async function searchImages(query) {
  const url = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&first=1`
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en-US' } })
  if (!res.ok) throw new Error(`Bing trả về ${res.status}`)
  const html = await res.text()
  const urls = [...html.matchAll(/murl&quot;:&quot;(.*?)&quot;/g)].map((m) => m[1])
  return [...new Set(urls)].filter((u) => {
    try {
      return !BLOCKED_HOSTS.test(new URL(u).hostname)
    } catch {
      return false
    }
  })
}

async function download(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Referer: new URL(url).origin + '/' },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  if (!/^image\//.test(res.headers.get('content-type') ?? '')) throw new Error('không phải ảnh')
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length < 8000) throw new Error('ảnh quá nhỏ')
  return buf
}

// Cắt viền trắng, đặt sản phẩm giữa khung vuông nền trắng, xuất WebP.
async function toSquareWebp(buf) {
  const meta = await sharp(buf).metadata()
  if (!meta.width || Math.min(meta.width, meta.height) < 250) throw new Error('độ phân giải thấp')
  const ratio = meta.width / meta.height
  if (ratio < 0.45 || ratio > 2.2) throw new Error('tỷ lệ ảnh lạ')

  const inner = Math.round(SIZE * 0.88)
  const trimmed = await sharp(buf).flatten({ background: '#ffffff' }).trim({ threshold: 12 }).toBuffer()
  const fitted = await sharp(trimmed)
    .resize(inner, inner, { fit: 'inside' })
    .toBuffer({ resolveWithObject: true })
  return sharp({
    create: { width: SIZE, height: SIZE, channels: 3, background: '#ffffff' },
  })
    .composite([
      {
        input: fitted.data,
        left: Math.round((SIZE - fitted.info.width) / 2),
        top: Math.round((SIZE - fitted.info.height) / 2),
      },
    ])
    .webp({ quality: 82 })
    .toBuffer()
}

async function fetchOne(product, map) {
  const prev = map[product.name]
  const skipUrls = new Set(prev?.rejected ?? [])
  if (prev?.source && redoName === product.name) skipUrls.add(prev.source)

  const query = customQuery ?? `${product.name} ${QUERY_HINT[product.slug] ?? ''}`
  const candidates = (await searchImages(query)).filter(
    (u) => !skipUrls.has(u),
  )
  for (const url of candidates.slice(0, 12)) {
    try {
      const buf = await download(url)
      const webp = await toSquareWebp(buf)
      const file = `${product.slug}-${slugify(product.name)}.webp`
      await writeFile(new URL(file, OUT_DIR), webp)
      map[product.name] = {
        image_url: PUBLIC_PREFIX + file,
        source: url,
        ...(skipUrls.size ? { rejected: [...skipUrls] } : {}),
      }
      return true
    } catch {
      // thử ảnh tiếp theo
    }
  }
  return false
}

async function writeSheet(products, map) {
  const cards = products
    .map((p) => {
      const img = map[p.name]?.image_url
      return `<figure><div>${img ? `<img src="../public${img}" loading="lazy">` : '<b>CHƯA CÓ ẢNH</b>'}</div><figcaption>${p.name}</figcaption></figure>`
    })
    .join('\n')
  const html = `<!doctype html><meta charset="utf-8"><title>Soát ảnh sản phẩm</title>
<style>body{font:13px system-ui;margin:16px;display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px}
figure{margin:0}div{aspect-ratio:1;border:1px solid #ddd;border-radius:8px;display:grid;place-items:center;overflow:hidden}
img{width:100%;height:100%;object-fit:contain}figcaption{margin-top:4px}</style>
${cards}`
  await writeFile(SHEET_FILE, html)
  console.log('Đã tạo data/images-preview.html – mở bằng trình duyệt để soát ảnh.')
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  const products = await loadProducts()
  const map = existsSync(MAP_FILE) ? JSON.parse(await readFile(MAP_FILE, 'utf8')) : {}

  if (args.includes('--sheet')) return writeSheet(products, map)

  if (redoName) {
    const entry = map[redoName]
    if (entry?.locked) throw new Error(`"${redoName}" đang locked trong data/images.json`)
    if (entry?.image_url) await rm(new URL('public' + entry.image_url, ROOT), { force: true })
  }

  const todo = products.filter((p) =>
    redoName
      ? p.name === redoName
      : !map[p.name]?.image_url || !existsSync(new URL('public' + map[p.name].image_url, ROOT)),
  )
  if (redoName && !todo.length) throw new Error(`Không có sản phẩm tên "${redoName}"`)
  console.log(`Cần tải ảnh cho ${todo.length}/${products.length} sản phẩm...`)

  const failed = []
  let done = 0
  const queue = [...todo]
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let p = queue.shift(); p; p = queue.shift()) {
        const ok = await fetchOne(p, map).catch(() => false)
        if (!ok) failed.push(p.name)
        console.log(`[${++done}/${todo.length}] ${ok ? 'OK ' : 'LỖI'} ${p.name}`)
      }
    }),
  )

  const sorted = Object.fromEntries(Object.entries(map).sort(([a], [b]) => a.localeCompare(b)))
  await writeFile(MAP_FILE, JSON.stringify(sorted, null, 2) + '\n')
  if (failed.length) console.log(`\nKhông tìm được ảnh cho:\n  ${failed.join('\n  ')}`)
  console.log('\nĐã cập nhật data/images.json. Chạy lại npm run import-data để ghi image_url lên DB.')
}

main().catch((err) => {
  console.error('Lỗi:', err.message)
  process.exit(1)
})
