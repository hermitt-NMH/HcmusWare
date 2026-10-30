// Kiểm thử hồi quy CHỈ ĐỌC trên bản Vercel (G2 Tuần 6, #116, #120) – chạy được cả sau code freeze.
// Không tạo tài khoản, không đặt đơn, không ghi gì vào DB online:
//   HQ-TRANG  mọi trang công khai × 360/1280 px × sáng/tối: đúng giao diện, có nội dung, không cuộn ngang,
//             header không tràn, không lỗi đỏ trong Console
//   HQ-CHAN   chưa đăng nhập mở trang theo vai trò (admin, kênh người bán, tài khoản, đơn) → sang /dang-nhap?next=…
//   HQ-EMAIL  /tat-email thiếu/sai token → "Link không hợp lệ"; token đúng dạng nhưng không có thật → bấm nút
//             vẫn báo không hợp lệ (RPC chỉ UPDATE theo token, không khớp dòng nào nên không đổi dữ liệu)
//   HQ-MUA    tìm kiếm → trang sản phẩm → thêm vào giỏ → giỏ → Thanh toán → bị đưa sang đăng nhập (dừng ở đây)
//   HQ-API    khóa anon đọc thẳng REST/RPC: không thấy hồ sơ, đơn, địa chỉ, sản phẩm/shop chưa duyệt, mục bị ẩn,
//             không gọi được hàm admin; bundle JS không chứa khóa service_role
// Đăng nhập theo từng vai trò vẫn do test:roles:online và test:rls:online kiểm (2 bộ đó có ghi dữ liệu).
//
// Cách chạy: npm run test:regression:online      (mặc định https://hcmusware.vercel.app)
//            node --env-file=.env.online.local scripts/regression-readonly.js <BASE_URL>
// Chỉ cần VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY. Ảnh các ca lỗi ghi vào ui-test-output/hoi-quy/.

import { spawn } from 'node:child_process'
import { writeFileSync, mkdirSync, mkdtempSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const BASE = (process.argv[2] || process.env.BASE_URL || 'https://hcmusware.vercel.app').replace(
  /\/$/,
  '',
)
const SB = process.env.VITE_SUPABASE_URL
const ANON = process.env.VITE_SUPABASE_ANON_KEY
if (!SB || !ANON)
  throw new Error('Thiếu VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY: chạy với --env-file')

const OUT = new URL('../ui-test-output/hoi-quy/', import.meta.url)
const PORT = 9341
const BROWSERS = [
  process.env.BROWSER,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean)

const browserPath = BROWSERS.find((p) => existsSync(p))
if (!browserPath) {
  console.error('Không tìm thấy Edge/Chrome. Đặt biến BROWSER=<đường dẫn trình duyệt>.')
  process.exit(1)
}
mkdirSync(OUT, { recursive: true })

const results = []
const rec = (code, ok, detail) => results.push({ code, ok, detail })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ---------- HQ-API: gọi thẳng Supabase bằng khóa anon (chỉ GET và RPC đọc) ----------

async function anon(path, { method = 'GET', body } = {}) {
  const res = await fetch(SB + path, {
    method,
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${ANON}`,
      'Content-Type': 'application/json',
      Prefer: 'count=exact',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const t = await res.text()
  let data = t
  try {
    data = JSON.parse(t)
  } catch {
    // giữ dạng chữ
  }
  const total = Number(res.headers.get('content-range')?.split('/')[1])
  return { status: res.status, ok: res.ok, data, total }
}
// Không đọc được = bị từ chối hẳn, hoặc trả về 0 dòng
const noRows = (r) => !r.ok || (Array.isArray(r.data) && r.data.length === 0 && !(r.total > 0))

for (const t of [
  'profiles',
  'orders',
  'order_items',
  'addresses',
  'notifications',
  'price_alerts',
  'saved_builds',
]) {
  const r = await anon(`/rest/v1/${t}?select=*&limit=1`)
  rec(
    `HQ-API ${t}`,
    noRows(r),
    r.ok ? `${r.total ?? 0} dòng` : `${r.status} ${r.data?.message ?? ''}`,
  )
}
{
  const ok = await anon('/rest/v1/products?select=id&limit=1')
  const notActive = await anon('/rest/v1/products?select=id,status&status=neq.active&limit=5')
  rec(
    'HQ-API products',
    ok.total > 0 && noRows(notActive),
    `đọc được ${ok.total} sản phẩm đang bán, ${notActive.total ?? notActive.data?.length ?? '?'} sản phẩm chưa duyệt/ẩn`,
  )
  const shops = await anon('/rest/v1/shops?select=id,status&status=neq.active&limit=5')
  rec('HQ-API shops', noRows(shops), `${shops.total ?? 0} shop chưa duyệt/bị khóa lộ ra`)
  for (const t of ['reviews', 'comments']) {
    const r = await anon(`/rest/v1/${t}?select=id&hidden=is.true&limit=5`)
    rec(`HQ-API ${t} ẩn`, noRows(r), r.ok ? `${r.total ?? 0} mục bị ẩn lộ ra` : `${r.status}`)
  }
}
for (const [fn, args] of [
  ['admin_list_users', { p_search: '', p_limit: 5 }],
  ['admin_list_shops', { p_status: null }],
  ['seller_unanswered_questions', {}],
]) {
  const r = await anon(`/rest/v1/rpc/${fn}`, { method: 'POST', body: args })
  // 404 = gọi sai tên/tham số hàm, ca test không còn kiểm gì → tính là lỗi
  const leaked = r.ok && Array.isArray(r.data) && r.data.length > 0
  rec(
    `HQ-API rpc ${fn}`,
    !leaked && r.status !== 404,
    `${r.status} ${r.ok ? `${r.data?.length ?? 0} dòng` : (r.data?.message ?? '')}`,
  )
}
{
  const r = await anon('/auth/v1/admin/users')
  rec('HQ-API auth admin', !r.ok, `${r.status}`)
}
{
  // Bundle JS chỉ được chứa khóa anon: giải mã mọi JWT tìm thấy, không có cái nào role = service_role
  const html = await (await fetch(BASE + '/')).text()
  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g)].map((m) => m[1])
  const jwts = new Set()
  for (const s of scripts) {
    const js = await (await fetch(new URL(s, BASE))).text()
    for (const m of js.matchAll(/eyJ[\w-]+\.eyJ[\w-]+\.[\w-]+/g)) jwts.add(m[0])
  }
  const roles = [...jwts].map((j) => {
    try {
      return JSON.parse(Buffer.from(j.split('.')[1], 'base64url').toString()).role
    } catch {
      return '?'
    }
  })
  rec(
    'HQ-API bundle',
    scripts.length > 0 && !roles.includes('service_role'),
    `${scripts.length} file JS, khóa tìm thấy: ${roles.join(', ') || 'không có'}`,
  )
}

// ---------- Trình duyệt headless qua DevTools Protocol (giống ui-test.js) ----------

const profile = mkdtempSync(join(tmpdir(), 'hoi-quy-'))
const browser = spawn(browserPath, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  '--no-first-run',
  '--disable-extensions',
  '--disable-component-extensions-with-background-pages',
  'about:blank',
])
let targets
for (let i = 0; i < 50 && !targets; i++) {
  try {
    targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()
  } catch {
    await sleep(200)
  }
}
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl)
await new Promise((r) => (ws.onopen = r))

let id = 0
const pending = new Map()
let consoleErrors = []
ws.onmessage = (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m)
    pending.delete(m.id)
  }
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error')
    consoleErrors.push(m.params.args.map((a) => a.value ?? a.description).join(' '))
  if (m.method === 'Runtime.exceptionThrown')
    consoleErrors.push('EXCEPTION ' + m.params.exceptionDetails.text)
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error')
    consoleErrors.push(`${m.params.entry.text} ${m.params.entry.url ?? ''}`)
}
const send = (method, params = {}) =>
  new Promise((r) => {
    const i = ++id
    pending.set(i, r)
    ws.send(JSON.stringify({ id: i, method, params }))
  })
const evaluate = async (expr) =>
  (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }))
    .result?.result?.value
const waitUntil = async (expr, ms = 15000) => {
  for (let i = 0; i < ms / 250; i++) {
    if (await evaluate(expr)) return true
    await sleep(250)
  }
  return false
}

await send('Runtime.enable')
await send('Log.enable')
await send('Page.enable')
await send('Network.enable')

async function setView(width, theme) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height: width < 600 ? 740 : 800,
    deviceScaleFactor: 1,
    mobile: width < 600,
  })
  // Máy để sáng/tối, chưa chọn giao diện trong web → index.html theo prefers-color-scheme
  await send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-color-scheme', value: theme }],
  })
}
// Chờ như ui-test.js: hết skeleton, hết "Đang tải", <main> có nội dung, rảnh 2 lần liên tiếp
async function open(path) {
  await send('Page.navigate', { url: BASE + path })
  let idle = 0
  for (let i = 0; i < 80 && idle < 2; i++) {
    await sleep(250)
    const busy = await evaluate(
      `document.readyState !== 'complete' || !!document.querySelector('.animate-pulse') ||
        /Đang tải|Đang kiểm tra quyền/.test(document.body.innerText) ||
        (document.querySelector('main')?.innerText.trim().length ?? 0) < 20`,
    )
    idle = busy === false ? idle + 1 : 0
  }
  await sleep(300)
}
async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
  writeFileSync(
    new URL(`${name.replace(/[^\w-]+/g, '_')}.png`, OUT),
    Buffer.from(r.result.data, 'base64'),
  )
}
const clearStorage = () => evaluate('localStorage.clear(); sessionStorage.clear()')

// Lấy id sản phẩm, thương hiệu, shop có thật từ chính trang web
await setView(1280, 'light')
await open('/')
const productPath = await evaluate(
  `document.querySelector('main a[href^="/san-pham/"]')?.getAttribute('href')`,
)
await open('/thuong-hieu')
const brandPath = await evaluate(
  `document.querySelector('main a[href^="/thuong-hieu/"]')?.getAttribute('href')`,
)
await open(productPath ?? '/san-pham/1')
const shopPath =
  (await evaluate(`document.querySelector('main a[href^="/shop/"]')?.getAttribute('href')`)) ??
  '/shop/hcmusware'

// ---------- HQ-TRANG ----------

const PAGES = [
  ['/', 'Trang chủ'],
  ['/san-pham', 'Tất cả sản phẩm'],
  ['/san-pham?q=ryzen', 'Kết quả tìm kiếm'],
  ['/danh-muc/cpu', 'Danh mục'],
  [productPath ?? '/san-pham/1', 'Chi tiết sản phẩm'],
  ['/thuong-hieu', 'Thương hiệu'],
  [brandPath ?? '/thuong-hieu/amd', 'Trang thương hiệu'],
  [shopPath, 'Trang shop'],
  ['/build-pc', 'Build PC'],
  ['/goi-y-cau-hinh', 'Gợi ý cấu hình'],
  ['/gio-hang', 'Giỏ hàng'],
  ['/dang-nhap', 'Đăng nhập'],
  ['/dang-ky', 'Đăng ký'],
  ['/chinh-sach-bao-mat', 'Chính sách bảo mật'],
  ['/tat-email', 'Tắt email'],
  ['/khong-co-trang-nay', 'Trang 404'],
]

for (const theme of ['light', 'dark']) {
  for (const width of [360, 1280]) {
    await setView(width, theme)
    for (const [path, name] of PAGES) {
      consoleErrors = []
      await open(path)
      const s = await evaluate(`(() => {
        const de = document.documentElement
        const h = document.querySelector('header')
        return {
          dark: de.classList.contains('dark'),
          hScroll: de.scrollWidth > de.clientWidth,
          headerW: h ? Math.round(h.getBoundingClientRect().width) : 0,
          main: document.querySelector('main')?.innerText.trim().length ?? 0,
          notFound: /Không tìm thấy trang bạn cần/.test(document.body.innerText),
          bg: getComputedStyle(document.body).backgroundColor,
        }
      })()`)
      const is404 = path === '/khong-co-trang-nay'
      const problems = []
      if (s.dark !== (theme === 'dark')) problems.push(`giao diện ${s.dark ? 'tối' : 'sáng'}`)
      if (s.hScroll) problems.push('cuộn ngang')
      if (s.headerW > width) problems.push(`header rộng ${s.headerW}px`)
      if (s.main < 20) problems.push('trang trống')
      if (s.notFound !== is404) problems.push(is404 ? 'không báo 404' : 'hiện trang 404')
      if (consoleErrors.length) problems.push(`Console: ${consoleErrors.slice(0, 2).join(' | ')}`)
      const code = `HQ-TRANG ${theme === 'dark' ? 'tối' : 'sáng'} ${width} ${path}`
      rec(code, problems.length === 0, problems.join('; ') || `${name}, nền ${s.bg}`)
      if (problems.length) await shot(code)
    }
  }
}

// ---------- HQ-CHAN ----------

await setView(1280, 'light')
await clearStorage()
for (const path of [
  '/admin',
  '/admin/nguoi-dung',
  '/admin/san-pham',
  '/admin/duyet',
  '/kenh-nguoi-ban',
  '/kenh-nguoi-ban/san-pham/moi',
  '/tai-khoan',
  '/tai-khoan/dia-chi',
  '/tai-khoan/mo-shop',
  '/don-hang/1',
  '/thanh-toan',
  '/thanh-toan/mo-phong/1',
]) {
  consoleErrors = []
  await open(path)
  await waitUntil(`location.pathname === '/dang-nhap'`, 8000)
  const loc = await evaluate('location.pathname + location.search')
  const next = new URLSearchParams(loc.split('?')[1] ?? '').get('next')
  // Lúc tải không được chớp hiện dữ liệu admin/người bán (PQ08)
  const leaked = await evaluate(
    `/Tồn kho|Duyệt shop|Danh sách người dùng/.test(document.body.innerText)`,
  )
  // /thanh-toan khi giỏ trống vẫn phải đòi đăng nhập trước (Checkout kiểm tra user trước giỏ)
  const ok = loc.startsWith('/dang-nhap') && next === path && !leaked
  rec(`HQ-CHAN ${path}`, ok, `→ ${loc}${leaked ? ', lộ chữ của trang quản lý' : ''}`)
  if (!ok) await shot(`HQ-CHAN ${path}`)
}

// ---------- HQ-EMAIL ----------

for (const [label, query, click] of [
  ['thiếu token', '', false],
  ['token sai dạng', '?t=abc&loai=gia', false],
  ['sai loại', '?t=00000000-0000-4000-8000-000000000000&loai=xyz', false],
  ['token không có thật (gia)', '?t=00000000-0000-4000-8000-000000000000&loai=gia', true],
  ['token không có thật (don)', '?t=11111111-1111-4111-8111-111111111111&loai=don', true],
]) {
  consoleErrors = []
  await open('/tat-email' + query)
  if (click) {
    await evaluate(
      `[...document.querySelectorAll('main button')].find((b) => /^Tắt /.test(b.innerText))?.click()`,
    )
    await waitUntil(
      `/Link không hợp lệ|Đã tắt|Không tắt được/.test(document.body.innerText)`,
      10000,
    )
  }
  const t = await evaluate('document.body.innerText')
  const ok = /Link không hợp lệ/.test(t) && !/Đã tắt/.test(t) && consoleErrors.length === 0
  rec(
    `HQ-EMAIL ${label}`,
    ok,
    ok ? 'báo "Link không hợp lệ"' : t.slice(0, 120).replace(/\s+/g, ' '),
  )
}

// ---------- HQ-MUA: tìm kiếm → sản phẩm → giỏ → thanh toán (dừng ở đăng nhập) ----------

for (const width of [360, 1280]) {
  await setView(width, 'light')
  await clearStorage()
  consoleErrors = []
  await open('/')
  const steps = []
  // Ô tìm kiếm ở Header (360 px nằm trong menu xổ, có thể đang ẩn) → gửi form như người gõ rồi Enter
  const typed = await evaluate(`(() => {
    const input = [...document.querySelectorAll('form[role="search"] input')]
      .find((i) => i.offsetParent) ?? document.querySelector('form[role="search"] input')
    if (!input) return false
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    set.call(input, 'ryzen')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.form.requestSubmit()
    return true
  })()`)
  const searched =
    typed &&
    (await waitUntil(
      `location.pathname === '/san-pham' && new URLSearchParams(location.search).get('q') === 'ryzen' &&
        document.querySelectorAll('main a[href^="/san-pham/"]').length > 0`,
    ))
  steps.push(`tìm "ryzen" ${searched ? 'ra kết quả' : 'LỖI'}`)
  // Chọn sản phẩm còn hàng đầu tiên trong kết quả
  const hrefs = await evaluate(
    `[...new Set([...document.querySelectorAll('main a[href^="/san-pham/"]')].map((a) => a.getAttribute('href')))]`,
  )
  let added = false
  let name = ''
  for (const href of (hrefs ?? []).slice(0, 5)) {
    await open(href)
    name = await evaluate(`document.querySelector('main h1')?.innerText ?? ''`)
    const clicked = await evaluate(
      `(() => { const b = [...document.querySelectorAll('main button')].find((x) => x.innerText.trim() === 'Thêm vào giỏ'); b?.click(); return !!b })()`,
    )
    if (clicked && (await waitUntil(`/Đã thêm vào giỏ/.test(document.body.innerText)`, 5000))) {
      added = true
      break
    }
  }
  steps.push(added ? `thêm "${name}"` : 'không thêm được vào giỏ')
  await open('/gio-hang')
  const inCart =
    added &&
    (await evaluate(`document.querySelector('main').innerText.includes(${JSON.stringify(name)})`))
  steps.push(inCart ? 'giỏ có sản phẩm' : 'giỏ thiếu sản phẩm')
  await evaluate(
    `[...document.querySelectorAll('main a[href="/thanh-toan"]')].find((a) => a.offsetParent)?.click()`,
  )
  const toLogin = await waitUntil(
    `location.pathname === '/dang-nhap' && new URLSearchParams(location.search).get('next') === '/thanh-toan'`,
    10000,
  )
  steps.push(toLogin ? 'Thanh toán → đăng nhập' : `Thanh toán → ${await evaluate('location.href')}`)
  const hs = await evaluate(
    'document.documentElement.scrollWidth > document.documentElement.clientWidth',
  )
  if (hs) steps.push('cuộn ngang')
  if (consoleErrors.length) steps.push(`Console: ${consoleErrors.slice(0, 2).join(' | ')}`)
  const ok = searched && added && inCart && toLogin && !hs && consoleErrors.length === 0
  rec(`HQ-MUA ${width}`, ok, steps.join(' → '))
  if (!ok) await shot(`HQ-MUA ${width}`)
  await clearStorage()
}

ws.close()
browser.kill()
await sleep(500)
try {
  rmSync(profile, { recursive: true, force: true })
} catch {
  // trình duyệt có thể còn giữ file, bỏ qua
}

console.log(`Hồi quy chỉ đọc: ${BASE}\n`)
for (const r of results) console.log(`${r.ok ? 'ĐẠT' : 'LỖI'}  ${r.code.padEnd(44)} ${r.detail}`)
const failed = results.filter((r) => !r.ok).length
console.log(
  `\n${results.length - failed}/${results.length} đạt · ảnh ca lỗi trong ui-test-output/hoi-quy/`,
)
process.exit(failed ? 1 : 0)
