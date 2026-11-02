// Vẽ sẵn HTML các trang công khai lúc build (#115, Lighthouse Mobile Hiệu năng ≥ 85).
// Trước đây mọi trang là <div id="root"></div> rỗng: phải tải ~170 KB JS, chạy xong, gọi Supabase rồi mới
// vẽ được gì → FCP/LCP ~4 giây dưới 4G chậm. Giờ HTML có sẵn nội dung + dữ liệu chụp lúc build;
// JS tải xong thì hydrate lên đó và vẫn gọi DB lấy dữ liệu mới (src/lib/ssrData.js).
//
// Chạy trong npm run build, sau `vite build` (client, ra dist/) và `vite build --ssr` (ra dist-ssr/):
//   dist/index.html           → trang chủ đã vẽ sẵn
//   dist/app-shell.html       → index.html gốc (rỗng), vercel.json trả file này cho đường dẫn không vẽ sẵn
//   dist/<đường dẫn>/index.html cho từng trang dưới đây
// Không đọc được Supabase hoặc một trang lỗi thì bỏ qua trang đó (dùng app-shell như cũ), không làm hỏng build.

// Ngày tháng (vd "Tham gia 11/2026") vẽ theo giờ Việt Nam như trình duyệt người dùng, không theo giờ UTC của máy build
process.env.TZ = 'Asia/Ho_Chi_Minh'

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { loadEnv } from 'vite'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DIST = join(ROOT, 'dist')
const CONCURRENCY = 6
const env = loadEnv('production', ROOT)
const URL_ = env.VITE_SUPABASE_URL
const KEY = env.VITE_SUPABASE_ANON_KEY

// Trang không cần dữ liệu riêng
const STATIC_PAGES = [
  '/',
  '/san-pham',
  '/thuong-hieu',
  '/build-pc',
  '/goi-y-cau-hinh',
  '/gio-hang',
  '/dang-nhap',
  '/dang-ky',
  '/chinh-sach-bao-mat',
]

async function rest(path) {
  const res = await fetch(`${URL_}/rest/v1/${path}`, {
    method: path.startsWith('rpc/') ? 'POST' : 'GET',
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: path.startsWith('rpc/') ? '{}' : undefined,
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`)
  return res.json()
}

// Danh mục, sản phẩm đang bán, shop đang hoạt động, thương hiệu có sản phẩm (cùng điều kiện với lib/api.js)
async function dataPages() {
  const [cats, products, shops, brands] = await Promise.all([
    rest('categories?select=slug'),
    rest('products?select=id,shops!inner(status)&status=eq.active&shops.status=eq.active&order=id'),
    rest('shops?select=slug&status=eq.active'),
    rest('rpc/brand_list'),
  ])
  return [
    ...cats.map((c) => `/danh-muc/${c.slug}`),
    ...products.map((p) => `/san-pham/${p.id}`),
    ...shops.map((s) => `/shop/${s.slug}`),
    ...brands.filter((b) => b.product_count > 0).map((b) => `/thuong-hieu/${b.slug}`),
  ]
}

// Đường dẫn → file: / → index.html, /san-pham/1 → san-pham/1/index.html (giữ dạng %xx như URL)
function outFile(path) {
  return join(DIST, ...path.split('/').filter(Boolean), 'index.html')
}

async function main() {
  const template = readFileSync(join(DIST, 'index.html'), 'utf8')
  const ROOT_DIV = '<div id="root"></div>'
  if (!template.includes(ROOT_DIV))
    throw new Error('dist/index.html không có <div id="root"></div>')
  writeFileSync(join(DIST, 'app-shell.html'), template)

  if (!URL_ || !KEY) {
    console.warn('prerender: thiếu VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY, bỏ qua vẽ sẵn')
    return
  }

  let pages = STATIC_PAGES
  try {
    // Dạng %xx như location.pathname của trình duyệt (main.jsx so khớp để quyết định hydrate)
    pages = [...STATIC_PAGES, ...(await dataPages())].map((p) => encodeURI(p))
  } catch (e) {
    console.warn(
      `prerender: không lấy được danh sách trang có dữ liệu (${e.message}), chỉ vẽ trang tĩnh`,
    )
  }

  const { render } = await import(pathToFileURL(join(ROOT, 'dist-ssr', 'entry-server.js')).href)
  // React in cảnh báo / lỗi của component ra console khi vẽ; gom lại để log gọn theo trang
  const failed = []
  let done = 0
  const queue = [...pages]
  async function worker() {
    for (let path; (path = queue.shift());) {
      try {
        const { html, script } = await render(path)
        const page = template.replace(
          ROOT_DIV,
          `<div id="root" data-prerendered="${path}">${html}</div>\n    ${script}`,
        )
        const file = outFile(path)
        mkdirSync(dirname(file), { recursive: true })
        writeFileSync(file, page)
        done++
      } catch (e) {
        failed.push(`${path}: ${e.message}`)
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  console.log(`prerender: ${done}/${pages.length} trang`)
  for (const f of failed) console.warn(`prerender: bỏ qua ${f}`)
}

main().catch((e) => {
  // Không làm hỏng deploy: web vẫn chạy như SPA với app-shell.html
  console.error('prerender lỗi, web chạy như SPA:', e)
})
