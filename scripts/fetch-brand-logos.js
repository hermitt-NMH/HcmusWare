// Logo thương hiệu (US-15.x): tải logo từ nguồn trong data/brand-logos.json, cắt viền, lưu WebP vào
// public/images/brands/<slug>.webp; --apply ghi đường dẫn đó vào brands.logo_url.
//
// Nguồn: ưu tiên file logo trên website chính hãng; trang chặn tải tự động thì lấy bản trên
// Wikimedia Commons; logo chỉ có dạng SVG nhúng trong HTML thì chép sẵn vào data/brand-logos/.
// "darken": true dành cho logo màu trắng (làm cho header nền tối) – ô LogoBadge nền trắng nên
// đổi các điểm ảnh sáng sang màu tối, phần có màu giữ nguyên.
//
// Cách chạy:
//   npm run brand-logos                     tải lại toàn bộ logo vào public/images/brands/
//   npm run brand-logos -- --only asus      chỉ tải một thương hiệu
//   npm run brand-logos:apply               ghi logo_url vào DB local (.env.local)
//   npm run brand-logos:apply:online        ghi logo_url vào DB online – deploy ảnh lên Vercel TRƯỚC
// --apply không đè logo admin đã tải lên ở /admin/thuong-hieu (chỉ ghi khi logo_url trống
// hoặc đang trỏ vào /images/brands/).

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import sharp from 'sharp'

const ROOT = new URL('../', import.meta.url)
const MAP_FILE = new URL('data/brand-logos.json', ROOT)
const OUT_DIR = new URL('public/images/brands/', ROOT)
const PUBLIC_PREFIX = '/images/brands/'

const MAX = 400 // cạnh dài nhất của ảnh xuất ra
const DARK = [30, 41, 59] // slate-800
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'

const args = process.argv.slice(2)
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null

async function loadSource({ url, file }) {
  if (file) return readFile(new URL(file, ROOT))
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Referer: new URL(url).origin + '/' },
    signal: AbortSignal.timeout(30000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

// SVG rất to (vd. 2586pt) vẽ ở density mặc định là đủ; SVG nhỏ thì tăng density cho nét.
async function rasterize(buf) {
  const meta = await sharp(buf).metadata()
  if (meta.format !== 'svg')
    return sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const density = Math.min(1200, Math.max(72, (72 * MAX * 2) / Math.max(meta.width, meta.height)))
  return sharp(buf, { density }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
}

async function toLogoWebp(buf, darken) {
  const { data, info } = await rasterize(buf)
  if (darken) {
    for (let i = 0; i < data.length; i += 4) {
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      if (data[i + 3] > 0 && lum > 170) [data[i], data[i + 1], data[i + 2]] = DARK
    }
  }
  const raw = { raw: { width: info.width, height: info.height, channels: 4 } }
  const trimmed = await sharp(data, raw).trim({ threshold: 10 }).png().toBuffer()
  return sharp(trimmed)
    .resize(MAX, MAX, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 90 })
    .toBuffer()
}

async function fetchAll(map) {
  await mkdir(OUT_DIR, { recursive: true })
  let ok = 0
  for (const [slug, entry] of Object.entries(map)) {
    if (only && slug !== only) continue
    // Wikimedia trả 429 nếu tải dồn dập
    if (entry.url?.includes('wikimedia.org')) await new Promise((r) => setTimeout(r, 3000))
    try {
      const webp = await toLogoWebp(await loadSource(entry), entry.darken)
      await writeFile(new URL(`${slug}.webp`, OUT_DIR), webp)
      ok++
      console.log(`✓ ${slug} (${entry.source})`)
    } catch (e) {
      console.log(`✗ ${slug}: ${e.message}`)
    }
  }
  console.log(`Xong: ${ok} logo trong public/images/brands/`)
}

async function apply() {
  const { createClient } = await import('@supabase/supabase-js')
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Thiếu VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  const supabase = createClient(url, key)

  const files = new Set((await readdir(OUT_DIR)).filter((f) => f.endsWith('.webp')))
  const { data: brands, error } = await supabase.from('brands').select('id, slug, logo_url')
  if (error) throw error

  let updated = 0
  for (const b of brands) {
    if (!files.has(`${b.slug}.webp`)) continue
    if (b.logo_url && !b.logo_url.startsWith(PUBLIC_PREFIX)) continue // admin đã tự tải logo
    const logo_url = `${PUBLIC_PREFIX}${b.slug}.webp`
    if (b.logo_url === logo_url) continue
    const { error: e } = await supabase.from('brands').update({ logo_url }).eq('id', b.id)
    if (e) throw e
    updated++
  }
  const missing = brands.filter((b) => !files.has(`${b.slug}.webp`)).map((b) => b.slug)
  console.log(`${url}: cập nhật ${updated}/${brands.length} thương hiệu.`)
  if (missing.length) console.log(`Chưa có logo (hiện chữ cái đầu): ${missing.join(', ')}`)
}

const map = JSON.parse(await readFile(MAP_FILE, 'utf8'))
if (args.includes('--apply')) await apply()
else await fetchAll(map)
