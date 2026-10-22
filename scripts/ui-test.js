// Kiểm thử giao diện UI01–UI09 (docs/test-plan.md) bằng Edge/Chrome headless qua DevTools Protocol.
// Không cần cài thêm thư viện.
//
// Cách chạy:
//   1. npm run db:start  (hoặc dùng bản Vercel, xem bước 3)
//   2. npm run build && npm run preview      – web chạy ở http://localhost:4173
//   3. npm run test:ui                        – mặc định kiểm thử http://localhost:4173
//      BASE_URL=https://<bản-vercel> npm run test:ui   – kiểm thử bản Vercel (PowerShell: $env:BASE_URL="...")
// Ảnh chụp màn hình ghi vào ui-test-output/. Có ca không đạt thì thoát với mã 1.
// Số sản phẩm mong đợi (16 mỗi danh mục, 128 tổng) theo dữ liệu sau `npm run import-data`.

import { spawn } from 'node:child_process'
import { writeFileSync, mkdirSync, mkdtempSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const BASE = (process.env.BASE_URL || 'http://localhost:4173').replace(/\/$/, '')
const OUT = new URL('../ui-test-output/', import.meta.url)
const PORT = 9333
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
try {
  await fetch(BASE)
} catch {
  console.error(`Không mở được ${BASE}. Chạy "npm run build && npm run preview" trước.`)
  process.exit(1)
}
mkdirSync(OUT, { recursive: true })

// Profile tạm, tắt tiện ích để Console không lẫn lỗi của tiện ích trình duyệt
const profile = mkdtempSync(join(tmpdir(), 'ui-test-'))
const browser = spawn(browserPath, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  '--no-first-run',
  '--disable-extensions',
  '--disable-component-extensions-with-background-pages',
  'about:blank',
])
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

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
const consoleErrors = []
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
  // window.confirm ("Làm lại từ đầu", "Xóa tất cả") → bấm OK
  if (m.method === 'Page.javascriptDialogOpening')
    ws.send(
      JSON.stringify({ id: ++id, method: 'Page.handleJavaScriptDialog', params: { accept: true } }),
    )
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

await send('Runtime.enable')
await send('Log.enable')
await send('Page.enable')
await send('Network.enable')

async function open(path, width, height = 800) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 600,
  })
  await send('Page.navigate', { url: BASE + path })
  // Chờ tải xong, hết skeleton và hết chữ "Đang tải" (lúc tải trang lazy hoặc danh mục ở Header).
  // Bản Vercel gọi Supabase online mất vài giây nên chờ tối đa 20 giây.
  // Phải "rảnh" 2 lần liên tiếp và <main> đã có nội dung: ngay sau khi điều hướng, React có thể
  // chưa kịp hiện skeleton nên lần kiểm tra đầu tưởng đã tải xong (UI01, GH07 thỉnh thoảng sai trên Vercel).
  let idle = 0
  for (let i = 0; i < 80 && idle < 2; i++) {
    await sleep(250)
    const busy = await evaluate(
      `document.readyState !== 'complete' || !!document.querySelector('.animate-pulse') ||
        /Đang tải/.test(document.body.innerText) ||
        (document.querySelector('main')?.innerText.trim().length ?? 0) < 20`,
    )
    idle = busy === false ? idle + 1 : 0
  }
  await sleep(300)
}
async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
  writeFileSync(new URL(`${name}.png`, OUT), Buffer.from(r.result.data, 'base64'))
}

// Chờ tới khi biểu thức JS trên trang đúng (tối đa ms). Bản Vercel gọi Supabase online chậm hơn
// local nhiều, chờ cố định vài giây thì thỉnh thoảng đọc trang khi dữ liệu chưa tải xong.
const waitUntil = async (expr, ms = 10000) => {
  for (let i = 0; i < ms / 250; i++) {
    if (await evaluate(expr)) return true
    await sleep(250)
  }
  return false
}

const results = []
const rec = (code, ok, detail) => results.push({ code, ok, detail })
const text = () => evaluate('document.body.innerText')
const hScroll = () =>
  evaluate('document.documentElement.scrollWidth > document.documentElement.clientWidth')
const productLinks = () =>
  evaluate(
    `new Set([...document.querySelectorAll('a[href^="/san-pham/"]')].map((a) => a.getAttribute('href'))).size`,
  )
// Lưới chứa đủ 8 ô danh mục trong <main> (bỏ qua menu ở Header)
const categoryGrid = () =>
  evaluate(`(() => {
    const g = [...document.querySelectorAll('main *')].find((el) =>
      getComputedStyle(el).display === 'grid' && el.querySelectorAll('a[href^="/danh-muc/"]').length >= 8)
    if (!g) return null
    return {
      count: g.querySelectorAll('a[href^="/danh-muc/"]').length,
      cols: getComputedStyle(g).gridTemplateColumns.split(' ').length,
    }
  })()`)

// UI01 – trang chủ 360 px
await open('/', 360)
{
  const g = await categoryGrid()
  const hs = await hScroll()
  const n = await productLinks()
  rec(
    'UI01',
    !hs && g?.count === 8 && g?.cols === 2 && n > 0,
    `cuộn ngang=${hs}, danh mục=${g?.count} ô/${g?.cols} cột, sản phẩm=${n}`,
  )
  await shot('UI01-home-360')
}

// UI02 – trang chủ 1366 px
await open('/', 1366)
{
  const g = await categoryGrid()
  const n = await productLinks()
  const t = await text()
  const price = /\d{1,3}(\.\d{3})+\s?₫/.test(t)
  const stock = /(còn|tồn kho|hết hàng)/i.test(t)
  rec(
    'UI02',
    g?.cols === 4 && n >= 8 && price && stock,
    `danh mục=${g?.cols} cột, sản phẩm=${n}, giá dạng 4.430.000 ₫=${price}, có tồn kho=${stock}`,
  )
  await shot('UI02-home-1366')
}

// UI03 – bấm ô danh mục RAM
await evaluate(`document.querySelector('main a[href="/danh-muc/ram"]')?.click()`)
await waitUntil(
  `location.pathname === '/danh-muc/ram' && new Set([...document.querySelectorAll('a[href^="/san-pham/"]')].map((a) => a.getAttribute('href'))).size >= 16`,
  20000,
)
{
  const path = await evaluate('location.pathname')
  const h1 = await evaluate(`document.querySelector('h1')?.innerText`)
  const n = await productLinks()
  rec(
    'UI03',
    path === '/danh-muc/ram' && /RAM/.test(h1 ?? '') && n === 16,
    `path=${path}, tiêu đề="${h1}", sản phẩm=${n}`,
  )
  await shot('UI03-ram')
}

// UI04 – bấm "Xem tất cả"
await open('/', 1366)
await evaluate(
  `[...document.querySelectorAll('a')].find((a) => /xem tất cả/i.test(a.innerText))?.click()`,
)
await waitUntil(
  `location.pathname === '/san-pham' && new Set([...document.querySelectorAll('a[href^="/san-pham/"]')].map((a) => a.getAttribute('href'))).size >= 128`,
  20000,
)
{
  const path = await evaluate('location.pathname')
  const n = await productLinks()
  rec('UI04', path === '/san-pham' && n === 128, `path=${path}, sản phẩm=${n}`)
}

// UI05 – Build PC, Giỏ hàng, Đăng nhập mở được, không trắng trang
for (const p of ['/build-pc', '/gio-hang', '/dang-nhap']) {
  await open(p, 1366)
  const len = (await text())?.trim().length ?? 0
  rec(`UI05 ${p}`, len > 50, `độ dài nội dung=${len} ký tự`)
}

// UI06 – đường dẫn sai
await open('/abc', 1366)
{
  const t = await text()
  const notFound = /404|không tìm thấy/i.test(t)
  const home = await evaluate(`!!document.querySelector('main a[href="/"]')`)
  rec('UI06', notFound && home, `có chữ 404/không tìm thấy=${notFound}, link về trang chủ=${home}`)
  await shot('UI06-404')
}

// UI08 – không lỗi đỏ trong Console (các trang trên + trang chi tiết sản phẩm)
await open('/san-pham', 1366)
const detail = await evaluate(
  `document.querySelector('a[href^="/san-pham/"]')?.getAttribute('href')`,
)
if (detail) await open(detail, 1366)
rec(
  'UI08',
  consoleErrors.length === 0,
  consoleErrors.length
    ? consoleErrors.slice(0, 5).join(' | ')
    : `không có lỗi đỏ (/, /danh-muc/ram, /san-pham, ${detail}, /build-pc, /gio-hang, /dang-nhap, /abc)`,
)

// UI09 – tải lại trực tiếp /danh-muc/cpu
await open('/danh-muc/cpu', 1366)
{
  const h1 = await evaluate(`document.querySelector('h1')?.innerText`)
  const n = await productLinks()
  rec('UI09', /CPU/.test(h1 ?? '') && n === 16, `tiêu đề="${h1}", sản phẩm=${n}`)
}

// UI07 – chặn API Supabase (trang web vẫn tải được) rồi tải lại trang danh mục
await send('Network.setBlockedURLs', { urls: ['*/rest/v1/*'] })
await send('Network.setCacheDisabled', { cacheDisabled: true })
await send('Page.reload', { ignoreCache: true })
let offlineText = ''
for (let i = 0; i < 60; i++) {
  await sleep(250)
  offlineText = (await text()) ?? ''
  if (/không tải được/i.test(offlineText)) break
}
rec(
  'UI07',
  /không tải được/i.test(offlineText),
  /không tải được/i.test(offlineText)
    ? 'hiện thông báo lỗi tải dữ liệu'
    : `nội dung: ${offlineText.slice(0, 120).replace(/\n/g, ' ')}`,
)
await shot('UI07-offline')
await send('Network.setBlockedURLs', { urls: [] })

// ---------- Builder (BD01–BD11) và giỏ hàng (GH01–GH07) ----------
// id sản phẩm của cấu hình B0 trong supabase/seed.sql
const SLOTS = ['cpu', 'mainboard', 'ram', 'vga', 'ssd', 'psu', 'case', 'cooler']
const B0 = { cpu: 1, mainboard: 2, ram: 3, vga: 4, ssd: 5, psu: 6, case: 7, cooler: 8 }
const BD_ERRORS_FROM = consoleErrors.length
const js = JSON.stringify
const setBuild = (ids, ramQty = 1) =>
  evaluate(`localStorage.setItem('hcmusware.build', ${js(js({ ids, ramQty }))})`)
const clearStorage = () => evaluate('localStorage.clear()')
// Chỉ lấy phần tử đang hiển thị (Builder render cả giao diện bảng lẫn từng bước, ẩn bằng CSS)
const VISIBLE = `(el) => el.getClientRects().length > 0`
// Nút linh kiện trong danh sách chọn (hộp thoại hoặc bước trên điện thoại)
const optionButtons = `[...document.querySelectorAll('li > button')].filter(${VISIBLE})
  .filter((b) => b.querySelector('.line-clamp-2'))`
const optionCount = () => evaluate(`${optionButtons}.length`)
const pick = async (name) => {
  await waitUntil(
    `${optionButtons}.some((b) => b.querySelector('.line-clamp-2').innerText.trim() === ${js(name)})`,
  )
  const ok = await evaluate(`(() => {
    const b = ${optionButtons}.find((b) => b.querySelector('.line-clamp-2').innerText.trim() === ${js(name)})
    b?.click()
    return !!b
  })()`)
  await sleep(400)
  return ok
}
const rowOf = (slug) => `document.querySelectorAll('table tbody tr')[${SLOTS.indexOf(slug)}]`
const rowText = (slug) => evaluate(`${rowOf(slug)}?.innerText ?? ''`)
const openRow = async (slug) => {
  await waitUntil(
    `!!${rowOf(slug)} && [...${rowOf(slug)}.querySelectorAll('button')].some((b) => /Chọn|Đổi/.test(b.innerText))`,
  )
  await evaluate(
    `[...${rowOf(slug)}.querySelectorAll('button')].find((b) => /Chọn|Đổi/.test(b.innerText))?.click()`,
  )
  await sleep(400)
}
const dialogText = () => evaluate(`document.querySelector('dialog[open]')?.innerText ?? ''`)
const clickText = async (re) => {
  const ok = await evaluate(`(() => {
    const b = [...document.querySelectorAll('button, a')].filter(${VISIBLE})
      .find((b) => ${re}.test(b.innerText.trim()))
    b?.click()
    return !!b
  })()`)
  await sleep(500)
  return ok
}
const addToCartDisabled = () =>
  evaluate(
    `[...document.querySelectorAll('button')].filter(${VISIBLE}).find((b) => /Thêm cấu hình vào giỏ/.test(b.innerText))?.disabled`,
  )
const headerCount = () =>
  evaluate(`document.querySelector('header a[href="/gio-hang"]')?.getAttribute('aria-label')`)

// BD01 – bảng 8 dòng ở 768 và 1366 px
for (const w of [768, 1366]) {
  await open('/', w)
  await clearStorage()
  await open('/build-pc', w)
  const rows = await evaluate(`[...document.querySelectorAll('table tbody tr')].filter(${VISIBLE})
    .map((r) => r.innerText)`)
  const allChoose = rows?.every((r) => /Chọn/.test(r))
  const hs = await hScroll()
  rec(
    `BD01 @${w}px`,
    rows?.length === 8 && allChoose && /Không bắt buộc/.test(rows[3]) && !hs,
    `số dòng=${rows?.length}, đều có nút Chọn=${allChoose}, cuộn ngang=${hs}`,
  )
  await shot(`BD01-builder-${w}`)
}

// BD02 – từng bước ở 360 px
await open('/build-pc', 360)
{
  const t = await text()
  const n = await optionCount()
  const hs = await hScroll()
  rec(
    'BD02 @360px',
    /Bước 1\/8: CPU/.test(t) && n === 16 && /Tổng cộng\s*0 ₫/.test(t) && /Bỏ qua/.test(t) && !hs,
    `có "Bước 1/8: CPU"=${/Bước 1\/8: CPU/.test(t)}, số CPU=${n}, cuộn ngang=${hs}`,
  )
  await shot('BD02-builder-360')
}

// BD05 – chọn CPU trên điện thoại thì tự sang bước Mainboard, chỉ còn mainboard AM5
await pick('AMD Ryzen 5 7600')
{
  const t = await text()
  const n = await optionCount()
  rec(
    'BD05 @360px',
    /Bước 2\/8: Mainboard/.test(t) && n === 5 && /✓\s*CPU/.test(t),
    `sang bước 2=${/Bước 2\/8: Mainboard/.test(t)}, số mainboard=${n}`,
  )
  await shot('BD05-builder-360-step2')
}

// BD03, BD04 – lọc theo CPU và mainboard trên máy tính
await clearStorage()
await open('/build-pc', 1366)
await openRow('cpu')
await pick('AMD Ryzen 5 7600')
await openRow('mainboard')
{
  const d = await dialogText()
  const n = await optionCount()
  await send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Escape',
    code: 'Escape',
    windowsVirtualKeyCode: 27,
  })
  await send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Escape',
    code: 'Escape',
    windowsVirtualKeyCode: 27,
  })
  await sleep(400)
  const closed = await evaluate(`!document.querySelector('dialog[open]')`)
  rec(
    'BD03',
    /Socket AM5 \(theo CPU\)/.test(d) && n === 5 && closed,
    `dòng lọc socket=${/Socket AM5/.test(d)}, số mainboard=${n}, Esc đóng=${closed}`,
  )
}
await openRow('mainboard')
await pick('MSI PRO B650M-A WIFI')
await openRow('ram')
{
  const d = await dialogText()
  const n = await optionCount()
  rec(
    'BD04',
    /DDR5 \(theo mainboard\)/.test(d) && n === 7,
    `dòng lọc DDR5=${/DDR5 \(theo/.test(d)}, số RAM=${n}`,
  )
  await shot('BD04-picker-ram')
  await pick('Kingston FURY Beast 32GB (2x16GB) DDR5-6000')
}

// BD06 – đủ B0 ở 3 cỡ màn hình (360 px xem ở bước Tổng kết) + 1024 px.
// Bảng: mọi nút (Đổi, ✕) phải nằm trọn trong khung, không bị cắt mất.
await setBuild(B0)
for (const w of [360, 768, 1024, 1366]) {
  await open('/build-pc', w)
  if (w === 360) await clickText(/^Tổng kết$/)
  // Chờ Builder tải xong 8 linh kiện và tính tổng (tối đa 10 giây). Trước đây đọc trang quá sớm
  // nên BD06 @1024px thỉnh thoảng báo sai dù web đúng.
  await waitUntil(`/Cấu hình tương thích/.test(document.body.innerText)`)
  const t = await text()
  const ok =
    /Cấu hình tương thích/.test(t) &&
    /29\.020\.000 ₫/.test(t) &&
    /~280 W/.test(t) &&
    /≥ 400 W/.test(t)
  const disabled = await addToCartDisabled()
  const clipped =
    w === 360
      ? 0
      : await evaluate(`(() => {
          const box = document.querySelector('table').parentElement.getBoundingClientRect()
          return [...document.querySelectorAll('table button')]
            .filter((b) => b.getBoundingClientRect().right > box.right + 1).length
        })()`)
  rec(
    `BD06 @${w}px`,
    ok && disabled === false && clipped === 0,
    `tương thích=${/Cấu hình tương thích/.test(t)}, tổng 29.020.000=${/29\.020\.000 ₫/.test(t)}, ~280 W=${/~280 W/.test(t)}, ≥400 W=${/≥ 400 W/.test(t)}, nút giỏ bấm được=${disabled === false}, nút bị cắt=${clipped}`,
  )
  await shot(`BD06-b0-${w}`)
}

// BD10 – tải lại vẫn giữ cấu hình (đang ở 1366 px với B0 lấy từ localStorage)
await send('Page.reload')
await sleep(500)
await waitUntil(`/29\\.020\\.000 ₫/.test(document.body.innerText)`, 20000)
{
  const rows = await evaluate(
    `[...document.querySelectorAll('table tbody tr')].map((r) => /Chưa chọn/.test(r.innerText))`,
  )
  const t = await text()
  rec(
    'BD10',
    rows?.every((x) => !x) && /29\.020\.000 ₫/.test(t),
    `dòng chưa chọn=${rows?.filter(Boolean).length}`,
  )
}

// BD07 – VGA dài hơn case
await openRow('case')
await pick('Zalman CUBIX')
await openRow('vga')
await pick('Zotac GeForce RTX 3080 Ti AMP Extreme Holo 12GB')
{
  const vga = await rowText('vga')
  const cs = await rowText('case')
  const t = await text()
  const disabled = await addToCartDisabled()
  rec(
    'BD07',
    /Lỗi/.test(vga) && /Lỗi/.test(cs) && /1 lỗi tương thích/.test(t) && disabled === true,
    `VGA có nhãn Lỗi=${/Lỗi/.test(vga)}, Case có nhãn Lỗi=${/Lỗi/.test(cs)}, "1 lỗi tương thích"=${/1 lỗi tương thích/.test(t)}, nút giỏ khóa=${disabled}`,
  )
  await shot('BD07-error')
}

// BD08 – CPU không có iGPU, không có VGA
await setBuild({ ...B0, cpu: 11, mainboard: 28, vga: undefined })
await open('/build-pc', 1366)
{
  await waitUntil(`/Còn thiếu: VGA/.test(document.body.innerText)`)
  const vga = await rowText('vga')
  const t = await text()
  const disabled = await addToCartDisabled()
  rec(
    'BD08',
    /Bắt buộc \(CPU không có iGPU\)/.test(vga) && /Còn thiếu: VGA/.test(t) && disabled === true,
    `VGA bắt buộc=${/Bắt buộc/.test(vga)}, "Còn thiếu: VGA"=${/Còn thiếu: VGA/.test(t)}, nút giỏ khóa=${disabled}`,
  )
}

// BD09 – 2 kit RAM
await setBuild(B0)
await open('/build-pc', 1366)
await waitUntil(
  `!!document.getElementById('ram-qty-desktop') && /29\\.020\\.000 ₫/.test(document.body.innerText)`,
)
await evaluate(`(() => {
  const s = document.getElementById('ram-qty-desktop')
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, '2')
  s.dispatchEvent(new Event('change', { bubbles: true }))
})()`)
await waitUntil(`/31\\.710\\.000 ₫/.test(document.body.innerText)`, 3000)
{
  const ram = await rowText('ram')
  const t = await text()
  rec(
    'BD09',
    /5\.380\.000 ₫/.test(ram) && /31\.710\.000 ₫/.test(t),
    `giá RAM 5.380.000=${/5\.380\.000 ₫/.test(ram)}, tổng 31.710.000=${/31\.710\.000 ₫/.test(t)}`,
  )
}

// GH01 – thêm cả cấu hình vào giỏ
await clickText(/^Thêm cấu hình vào giỏ$/)
// Trang giỏ tải lại giá/tồn kho từ DB rồi mới hiện tạm tính
await waitUntil(
  `location.pathname === '/gio-hang' && /31\\.710\\.000 ₫/.test(document.body.innerText)`,
  20000,
)
const cartLines = () => evaluate(`document.querySelectorAll('main ul > li').length`)
const cartQty = (name) =>
  evaluate(`(() => {
    const li = [...document.querySelectorAll('main ul > li')].find((li) => li.innerText.includes(${js(name)}))
    return li ? Number(li.querySelector('[aria-live]')?.innerText) : null
  })()`)
{
  const path = await evaluate('location.pathname')
  const t = await text()
  const n = await cartLines()
  const ram = await cartQty('Kingston FURY Beast')
  const badge = await headerCount()
  rec(
    'GH01',
    path === '/gio-hang' &&
      /Giỏ hàng \(9\)/.test(t) &&
      n === 8 &&
      ram === 2 &&
      /31\.710\.000 ₫/.test(t) &&
      /\b9\b/.test(badge ?? ''),
    `path=${path}, số dòng=${n}, RAM sl=${ram}, tạm tính 31.710.000=${/31\.710\.000 ₫/.test(t)}, Header="${badge}"`,
  )
  await shot('GH01-cart-1366')
}

// GH02 – tăng CPU, xóa SSD
await evaluate(
  `document.querySelector('button[aria-label="Tăng số lượng AMD Ryzen 5 7600"]')?.click()`,
)
await sleep(300)
await evaluate(
  `document.querySelector('button[aria-label="Xóa Samsung 990 EVO 1TB khỏi giỏ"]')?.click()`,
)
await sleep(500)
const gh02 = async () => {
  const t = await text()
  const cpu = await cartQty('AMD Ryzen 5 7600')
  const ssd = /Samsung 990 EVO/.test(t)
  return {
    ok: /Giỏ hàng \(9\)/.test(t) && cpu === 2 && !ssd && /35\.010\.000 ₫/.test(t),
    detail: `CPU sl=${cpu}, còn SSD=${ssd}, tạm tính 35.010.000=${/35\.010\.000 ₫/.test(t)}`,
  }
}
{
  const r = await gh02()
  rec('GH02', r.ok, r.detail)
}

// GH03 – tải lại vẫn giữ giỏ
await open('/gio-hang', 1366)
{
  const r = await gh02()
  rec('GH03', r.ok, r.detail)
}

// GH04 – "+" dừng ở min(tồn kho, 10): Case NZXT H5 Flow còn 8
for (let i = 0; i < 12; i++)
  await evaluate(
    `document.querySelector('button[aria-label="Tăng số lượng NZXT H5 Flow"]')?.click()`,
  )
await sleep(400)
{
  const q = await cartQty('NZXT H5 Flow')
  const dis = await evaluate(
    `document.querySelector('button[aria-label="Tăng số lượng NZXT H5 Flow"]')?.disabled`,
  )
  rec('GH04', q === 8 && dis === true, `số lượng case=${q} (tồn 8), nút + mờ=${dis}`)
}

// GH05 – giỏ trên 360 px
await open('/gio-hang', 360)
{
  const hs = await hScroll()
  const small =
    await evaluate(`[...document.querySelectorAll('main ul > li button')].filter(${VISIBLE})
    .filter((b) => { const r = b.getBoundingClientRect(); return r.width < 44 || r.height < 44 }).length`)
  rec('GH05', !hs && small === 0, `cuộn ngang=${hs}, nút nhỏ hơn 44 px=${small}`)
  await shot('GH05-cart-360')
}

// GH06 – xóa tất cả
await open('/gio-hang', 1366)
await clickText(/^Xóa tất cả$/)
{
  const t = await text()
  rec(
    'GH06',
    /Giỏ hàng trống/.test(t) && /Build PC/.test(t) && /Xem sản phẩm/.test(t),
    `hiện "Giỏ hàng trống"=${/Giỏ hàng trống/.test(t)}`,
  )
}

// GH07 – thêm 1 sản phẩm từ trang chi tiết
await open('/san-pham/1', 1366)
{
  await waitUntil(
    `[...document.querySelectorAll('button')].some((b) => b.innerText.trim() === 'Thêm vào giỏ')`,
  )
  const before = await headerCount()
  await clickText(/^Thêm vào giỏ$/)
  await waitUntil(`/Đã thêm vào giỏ/.test(document.body.innerText)`, 3000)
  const t = await text()
  const after = await headerCount()
  rec(
    'GH07',
    /Đã thêm vào giỏ/.test(t) && /\b1\b/.test(after ?? '') && !/\b1\b/.test(before ?? ''),
    `Header trước="${before}", sau="${after}", nút "Đã thêm"=${/Đã thêm vào giỏ/.test(t)}`,
  )
}

// BD11 – làm lại từ đầu
await setBuild(B0)
await open('/build-pc', 1366)
await clickText(/^Làm lại từ đầu$/)
{
  const rows = await evaluate(
    `[...document.querySelectorAll('table tbody tr')].map((r) => /Chưa chọn/.test(r.innerText))`,
  )
  const t = await text()
  rec(
    'BD11',
    rows?.every(Boolean) && /Tổng cộng\s*0 ₫/.test(t),
    `dòng chưa chọn=${rows?.filter(Boolean).length}/8`,
  )
}

const bdErrors = consoleErrors.slice(BD_ERRORS_FROM)
rec(
  'BD/GH Console',
  bdErrors.length === 0,
  bdErrors.length
    ? bdErrors.slice(0, 5).join(' | ')
    : 'không có lỗi đỏ khi chạy Builder và giỏ hàng',
)
await clearStorage()

// Thêm: 360 px và 768 px không có thanh cuộn ngang
const overflow = []
for (const p of ['/', '/san-pham', '/build-pc', '/gio-hang']) {
  for (const w of [360, 768]) {
    await open(p, w)
    if (await hScroll()) overflow.push(`${p} @${w}px`)
  }
}
rec(
  'Responsive',
  overflow.length === 0,
  overflow.length ? `cuộn ngang: ${overflow.join(', ')}` : '4 trang × 360/768 px không cuộn ngang',
)

ws.close()
browser.kill()
await sleep(500)
try {
  rmSync(profile, { recursive: true, force: true })
} catch {
  // trình duyệt có thể còn giữ file, bỏ qua
}

console.log(`Kiểm thử giao diện: ${BASE}\n`)
for (const r of results) console.log(`${r.ok ? 'ĐẠT' : 'LỖI'}  ${r.code.padEnd(16)} ${r.detail}`)
const failed = results.filter((r) => !r.ok).length
console.log(`\n${results.length - failed}/${results.length} đạt · ảnh chụp trong ui-test-output/`)
process.exit(failed ? 1 : 0)
