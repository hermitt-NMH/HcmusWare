// Kiểm thử giao diện theo vai trò – Giai đoạn 2 Tuần 1: F13 phân quyền (menu, chặn trang, đổi vai trò)
// và F18 sáng/tối (nhớ lựa chọn, không nháy, tương phản chữ). Mã ca PQ, ND, TH, CT, TT: docs/test-plan.md.
// Tự tạo 3 tài khoản qa-*@hcmusware.test và 1 shop chờ duyệt, cuối cùng xóa sạch.
// Cần VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY trong file env; Edge hoặc Chrome trên máy.
//
// Cách chạy:
//   Local : npm run build && npm run preview, rồi npm run test:roles   (web ở http://localhost:4173)
//   Vercel: npm run db:backup trước, rồi npm run test:roles:online
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const SB = process.env.VITE_SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const BASE = (process.argv[2] || process.env.BASE_URL || 'http://localhost:4173').replace(/\/$/, '')
const OUT = join(import.meta.dirname, '..', 'ui-test-output', 'role-test')
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function sb(path, { method = 'GET', body, prefer } = {}) {
  const res = await fetch(SB + path, {
    method,
    headers: {
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const t = await res.text()
  return { status: res.status, data: t ? JSON.parse(t) : null }
}
// Dọn tài khoản test của lần chạy hỏng trước (xóa shop trước vì shops.owner_id chặn xóa user).
const oldUsers = (await sb('/auth/v1/admin/users?per_page=1000')).data.users ?? []
for (const u of oldUsers.filter((u) => /^qa-[a-z]+-\d+@hcmusware\.test$/.test(u.email))) {
  await sb(`/rest/v1/shops?owner_id=eq.${u.id}`, { method: 'DELETE' })
  await sb(`/auth/v1/admin/users/${u.id}`, { method: 'DELETE' })
}

const ts = Date.now()
const PASS = 'Qa-G2-' + ts
const users = {}
async function mk(tag, role, name) {
  const email = `qa-${tag}-${ts}@hcmusware.test`
  const r = await sb('/auth/v1/admin/users', {
    method: 'POST',
    body: { email, password: PASS, email_confirm: true, user_metadata: { full_name: name } },
  })
  if (!r.data.id) throw new Error(JSON.stringify(r.data))
  if (role !== 'customer')
    await sb(`/rest/v1/profiles?id=eq.${r.data.id}`, { method: 'PATCH', body: { role } })
  users[tag] = { email, id: r.data.id }
}
await mk('khach', 'customer', 'QA Khach Hang')
await mk('ban', 'seller', 'QA Nguoi Ban')
await mk('admin', 'admin', 'QA Quan Tri')
const shop = await sb('/rest/v1/shops', {
  method: 'POST',
  prefer: 'return=representation',
  body: { owner_id: users.ban.id, name: 'Shop QA', slug: 'shop-qa-' + ts, status: 'pending' },
})
const shopId = shop.data?.[0]?.id

// ---------- Trình duyệt ----------
const browserPath = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].find((p) => existsSync(p))
const browser = spawn(browserPath, [
  '--headless=new',
  '--remote-debugging-port=9336',
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'qa-g2-'))}`,
  '--no-first-run',
  'about:blank',
])
let targets
for (let i = 0; i < 50 && !targets; i++) {
  try {
    targets = await (await fetch('http://127.0.0.1:9336/json')).json()
  } catch {
    await sleep(200)
  }
}
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl)
await new Promise((r) => (ws.onopen = r))
let mid = 0
const pending = new Map()
const consoleErrors = []
ws.onmessage = (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m)
    pending.delete(m.id)
  }
  if (m.method === 'Runtime.exceptionThrown') consoleErrors.push(m.params.exceptionDetails.text)
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error')
    consoleErrors.push(m.params.args.map((a) => a.value ?? a.description).join(' '))
  if (m.method === 'Page.javascriptDialogOpening')
    send('Page.handleJavaScriptDialog', { accept: true })
}
const send = (method, params = {}) =>
  new Promise((r) => {
    const i = ++mid
    pending.set(i, r)
    ws.send(JSON.stringify({ id: i, method, params }))
  })
const ev = async (expr) =>
  (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }))
    .result?.result?.value
await send('Runtime.enable')
await send('Page.enable')
// Ghi lại mọi chữ từng xuất hiện trong <main> (bắt "chớp dữ liệu" lúc đang tải) và trạng thái dark lúc vẽ đầu.
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `window.__seen = ''; window.__darkAtStart = null;
  document.addEventListener('DOMContentLoaded', () => {
    window.__darkAtStart = document.documentElement.classList.contains('dark')
    new MutationObserver(() => { const m = document.querySelector('main'); if (m) window.__seen += '\\n' + m.innerText })
      .observe(document.body, { childList: true, subtree: true, characterData: true })
  })`,
})
async function waitFor(expr, ms = 15000) {
  for (let t = 0; t < ms; t += 200) {
    if (await ev(expr)) return true
    await sleep(200)
  }
  return false
}
const notBusy = `document.readyState==='complete' && !/Đang tải|Đang kiểm tra/.test(document.body.innerText)`
async function size(width) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height: 900,
    deviceScaleFactor: 1,
    mobile: width < 600,
  })
}
async function open(p) {
  await send('Page.navigate', { url: BASE + p })
  await sleep(400)
  await waitFor(notBusy)
  await sleep(500)
  // Đã đăng nhập thì chờ hồ sơ tải xong (header hết nhãn tạm "Tài khoản") rồi mới đọc menu
  await waitFor(
    `!Object.keys(localStorage).some((k) => k.endsWith('-auth-token')) || !/Tài khoản/.test(document.querySelector('header')?.innerText || '')`,
    5000,
  )
}
const path = () => ev('location.pathname + location.search')
const text = () => ev('document.body.innerText')
const headerText = () => ev(`document.querySelector('header').innerText`)
const shot = async (name) => {
  const r = await send('Page.captureScreenshot', { format: 'png' })
  if (r.result?.data) writeFileSync(join(OUT, name + '.png'), Buffer.from(r.result.data, 'base64'))
}
const fillJs = (sel, val) => `(() => { const el = ${sel}; if (!el) return false
  const proto = el.tagName === 'SELECT' ? HTMLSelectElement : HTMLInputElement
  Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, ${JSON.stringify(val)})
  el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); return true })()`
async function login(email) {
  await waitFor(`!!document.querySelector('input[type=email]')`)
  await ev(fillJs(`document.querySelector('input[type=email]')`, email))
  await ev(fillJs(`document.querySelector('input[type=password]')`, PASS))
  await ev(`document.querySelector('input[type=email]').form.requestSubmit()`)
  await waitFor(`!location.pathname.startsWith('/dang-nhap')`)
  await sleep(500)
  await waitFor(notBusy)
}
async function logout() {
  await ev(`localStorage.clear()`)
  await ev(`Object.keys(localStorage).forEach(k => localStorage.removeItem(k))`)
}
// Các mục menu nhìn thấy được (header + menu xổ), theo thứ tự DOM, bỏ danh mục sản phẩm
const visibleNav = () =>
  ev(`(() => { const cats = new Set([...document.querySelectorAll('header a[href^="/danh-muc/"]')].map(a=>a));
    return [...document.querySelectorAll('header nav a, header nav button, header ul a, header ul button')]
      .filter(a => !cats.has(a) && a.offsetParent !== null && a.getBoundingClientRect().width > 0)
      .map(a => (a.getAttribute('aria-label') || a.innerText).trim().replace(/, \\d+ sản phẩm/, '')) })()`)

const results = []
const rec = (code, ok, detail) => {
  results.push({ code, ok, detail })
  console.log(`${ok ? 'ĐẠT' : 'LỖI'}  ${code.padEnd(6)} ${detail}`)
}

// ===== F13 – chưa đăng nhập =====
await size(1366)
await open('/')
let h = await headerText()
rec(
  'PQ01',
  /Đăng nhập/.test(h) && !/Quản trị|Kênh người bán|Tài khoản/.test(h),
  `header="${h.replace(/\n/g, ' | ').slice(0, 160)}"`,
)
await open('/admin/nguoi-dung')
const p1 = await path()
await open('/kenh-nguoi-ban/abc')
const p2 = await path()
rec(
  'PQ02',
  p1 === '/dang-nhap?next=%2Fadmin%2Fnguoi-dung' &&
    p2 === '/dang-nhap?next=%2Fkenh-nguoi-ban%2Fabc',
  `${p1} ; ${p2}`,
)

// đăng nhập xong quay lại đúng trang
await open('/admin/nguoi-dung')
await login(users.admin.email)
rec('PQ03', (await path()) === '/admin/nguoi-dung', `sau đăng nhập admin: ${await path()}`)
const adminNav1366 = await visibleNav()
await size(360)
await open('/')
await ev(`document.querySelector('button[aria-label="Mở menu danh mục"]').click()`)
await sleep(300)
const adminNav360 = await visibleNav()
rec(
  'PQ04',
  JSON.stringify(adminNav1366.filter((x) => x !== 'Mở menu danh mục')) ===
    JSON.stringify(adminNav360.filter((x) => x !== 'Mở menu danh mục')),
  `admin 1366=${JSON.stringify(adminNav1366)} | 360=${JSON.stringify(adminNav360)}`,
)
await size(1366)
await open('/kenh-nguoi-ban')
rec('PQ05', /Không có quyền truy cập/.test(await text()), `admin mở /kenh-nguoi-ban`)

// ===== US-13.4 admin đổi vai trò =====
await open('/admin/nguoi-dung')
await ev(fillJs(`document.querySelector('input[type=search][aria-label="Tìm người dùng"]')`, 'qa-'))
await ev(`document.querySelector('form[role=search] button[type=submit]').click()`)
await sleep(1500)
await waitFor(notBusy)
const rows = await ev(
  `[...document.querySelectorAll('main li')].map(l=>l.innerText.replace(/\\n/g,' | '))`,
)
rec(
  'ND01',
  rows.filter((r) => r.includes(String(ts))).length === 3,
  `tìm "qa-": ${rows.length} dòng; ${JSON.stringify(rows.filter((r) => r.includes(String(ts))))}`,
)
const selfDisabled = await ev(
  `document.querySelector('select[aria-label="Vai trò của ${users.admin.email}"]')?.disabled`,
)
rec('ND02', selfDisabled === true, `select vai trò của chính mình disabled=${selfDisabled}`)
// tìm theo tên
await ev(fillJs(`document.querySelector('input[aria-label="Tìm người dùng"]')`, 'QA Khach'))
await ev(`document.querySelector('form[role=search] button[type=submit]').click()`)
await sleep(1500)
const byName = await ev(
  `[...document.querySelectorAll('main li')].map(l=>l.innerText.replace(/\\n/g,' | '))`,
)
rec(
  'ND03',
  byName.some((r) => r.includes(users.khach.email)),
  `tìm theo tên "QA Khach": ${byName.length} dòng`,
)
// đổi khách → người bán
await ev(
  fillJs(
    `document.querySelector('select[aria-label="Vai trò của ${users.khach.email}"]')`,
    'seller',
  ),
)
await sleep(1500)
const dbRole = (await sb(`/rest/v1/profiles?id=eq.${users.khach.id}&select=role`)).data[0].role
rec('ND04', dbRole === 'seller', `sau khi đổi trên UI, DB role=${dbRole}`)
// bấm Tìm lại → vẫn hiện vai trò mới
await ev(`document.querySelector('form[role=search] button[type=submit]').click()`)
await sleep(1500)
const shown = await ev(
  `document.querySelector('select[aria-label="Vai trò của ${users.khach.email}"]')?.value`,
)
rec('ND05', shown === 'seller', `tìm lại: select hiện ${shown}`)
await shot('admin-users-light')
// dark mode admin
await ev(`localStorage.setItem('hcmusware.theme','dark')`)
await open('/admin/nguoi-dung')
await shot('admin-users-dark')

// ===== Khách (giờ là người bán, chưa có shop) =====
await ev(`localStorage.clear()`)
await open('/dang-nhap')
await login(users.khach.email)
await open('/')
h = await headerText()
rec(
  'PQ06',
  /Kênh người bán/.test(h) && !/Quản trị/.test(h),
  `khách vừa được nâng thành người bán, header="${h.replace(/\n/g, ' | ').slice(0, 160)}"`,
)
await open('/kenh-nguoi-ban')
rec(
  'PQ07',
  /chưa có shop/.test(await text()),
  `người bán chưa có shop: "${(await ev(`document.querySelector('main').innerText`)).slice(0, 120)}"`,
)

// ===== Người bán có shop =====
await ev(`localStorage.clear()`)
await open('/dang-nhap')
await login(users.ban.email)
await open('/admin/san-pham')
const seenSeller = await ev('window.__seen')
rec(
  'PQ08',
  /Không có quyền truy cập/.test(await text()) && !/Sửa|Xóa|Tồn kho/.test(seenSeller),
  `người bán mở /admin/san-pham; chữ từng hiện: "${seenSeller.replace(/\s+/g, ' ').slice(0, 120)}"`,
)
await open('/kenh-nguoi-ban')
const sc = await ev(`document.querySelector('main').innerText`)
rec(
  'PQ09',
  /Shop QA/.test(sc) && /Chờ admin duyệt/.test(sc),
  `kênh người bán: "${sc.replace(/\n/g, ' | ').slice(0, 140)}"`,
)

// ===== F18 =====
await ev(`localStorage.removeItem('hcmusware.theme')`)
await send('Emulation.setEmulatedMedia', {
  features: [{ name: 'prefers-color-scheme', value: 'dark' }],
})
await open('/')
rec(
  'TH01',
  (await ev(`document.documentElement.classList.contains('dark')`)) === true,
  `máy để tối, chưa chọn → dark`,
)
const toggle = await ev(
  `[...document.querySelectorAll('header button')].filter(b=>b.offsetParent).map(b=>b.getAttribute('aria-label'))`,
)
rec(
  'TH02',
  toggle.includes('Chuyển sang giao diện sáng'),
  `nút trên header: ${JSON.stringify(toggle)}`,
)
await ev(
  `[...document.querySelectorAll('header button')].find(b=>b.offsetParent && /giao diện/.test(b.getAttribute('aria-label'))).click()`,
)
await sleep(200)
const afterToggle = await ev(
  `[document.documentElement.classList.contains('dark'), localStorage.getItem('hcmusware.theme')]`,
)
await send('Emulation.setEmulatedMedia', {
  features: [{ name: 'prefers-color-scheme', value: 'light' }],
})
await ev(`localStorage.setItem('hcmusware.theme','dark')`)
await open('/san-pham/21')
const darkStart = await ev('window.__darkAtStart')
rec(
  'TH03',
  afterToggle[0] === false && afterToggle[1] === 'light' && darkStart === true,
  `sau bấm: ${JSON.stringify(afterToggle)}; F5 khi đã chọn tối, dark lúc DOMContentLoaded=${darkStart}`,
)

// Tương phản chữ ở cả 2 chế độ trên nhiều trang
const contrastJs = `(() => {
  const cv = (window.__cv ||= document.createElement('canvas').getContext('2d', { willReadFrequently: true }))
  const parse = (c) => { cv.clearRect(0,0,1,1); cv.fillStyle = '#000'; cv.fillStyle = c; cv.fillRect(0,0,1,1); const d = cv.getImageData(0,0,1,1).data; return { r:d[0], g:d[1], b:d[2], a: d[3]/255 } }
  const lum = ({r,g,b}) => { const f = (v) => { v/=255; return v<=0.03928 ? v/12.92 : ((v+0.055)/1.055)**2.4 }; return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b) }
  const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const s = getComputedStyle(e); if (s.backgroundImage !== 'none' && e.tagName !== 'BODY') return null; const c = parse(s.backgroundColor); if (c.a > 0.5) return c } return parse(getComputedStyle(document.body).backgroundColor) }
  const bad = []
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const seen = new Set()
  while (walker.nextNode()) {
    const t = walker.currentNode; const el = t.parentElement
    if (!t.textContent.trim() || seen.has(el)) continue; seen.add(el)
    if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') continue
    const s = getComputedStyle(el); if (s.visibility === 'hidden' || +s.opacity < 0.9) continue
    if (el.closest('button:disabled, [disabled], [aria-disabled=true], .sr-only, canvas')) continue
    const fg = parse(s.color); const bg = bgOf(el); if (!bg) continue
    const L1 = lum(fg), L2 = lum(bg); const ratio = (Math.max(L1,L2)+0.05)/(Math.min(L1,L2)+0.05)
    const large = parseFloat(s.fontSize) >= 24 || (parseFloat(s.fontSize) >= 18.66 && +s.fontWeight >= 700)
    if (ratio < (large ? 3 : 4.5)) bad.push(ratio.toFixed(2) + ' "' + t.textContent.trim().slice(0,40) + '" ' + s.color + ' / rgb(' + bg.r+','+bg.g+','+bg.b + ')')
  }
  return bad })()`
const pages = [
  '/',
  '/san-pham/21',
  '/build-pc',
  '/gio-hang',
  '/tai-khoan',
  '/kenh-nguoi-ban',
  '/admin/san-pham',
  '/dang-nhap',
]
for (const theme of ['light', 'dark']) {
  await ev(`localStorage.setItem('hcmusware.theme','${theme}')`)
  for (const p of pages) {
    await open(p)
    const bad = await ev(contrastJs)
    const uniq = [...new Set(bad)]
    rec(
      `CT-${theme[0]}`,
      uniq.length === 0,
      `${p}: ${uniq.length} chỗ <4.5:1 ${uniq.slice(0, 6).join(' ; ')}`,
    )
    if (p === '/kenh-nguoi-ban') await shot('seller-' + theme)
  }
}
// ===== US-13.1: thứ tự menu của admin và người bán ở 360/640/768/1024/1366 px giống 1366, header không tràn =====
const navAt = async (w) => {
  await size(w)
  await open('/')
  const hasBurger = await ev(
    `(() => { const b = document.querySelector('button[aria-label="Mở menu danh mục"]'); return !!b && b.offsetParent !== null })()`,
  )
  if (hasBurger) {
    await ev(`document.querySelector('button[aria-label="Mở menu danh mục"]').click()`)
    await sleep(300)
  }
  const nav = (await visibleNav()).filter((x) => x !== 'Mở menu danh mục')
  const over = await ev(
    `(() => { const bar = document.querySelector('header > div'); return Math.round(Math.max(bar.scrollWidth, document.documentElement.scrollWidth) - innerWidth) })()`,
  )
  return { nav, over }
}
for (const who of ['admin', 'ban']) {
  await size(1366)
  await open('/')
  await logout()
  await open('/dang-nhap')
  await login(users[who].email)
  const ref = await navAt(1366)
  for (const w of [360, 640, 768, 1024, 1366]) {
    const r = await navAt(w)
    rec(
      `TT-${who}-${w}`,
      JSON.stringify(r.nav) === JSON.stringify(ref.nav) && r.over <= 0,
      `tràn=${r.over}px ${JSON.stringify(r.nav)}`,
    )
  }
  await logout()
}
rec('CON', consoleErrors.length === 0, `lỗi console: ${JSON.stringify(consoleErrors.slice(0, 5))}`)

// ---------- Dọn dẹp ----------
browser.kill()
if (shopId) await sb(`/rest/v1/shops?id=eq.${shopId}`, { method: 'DELETE' })
for (const u of Object.values(users)) {
  const r = await sb(`/auth/v1/admin/users/${u.id}`, { method: 'DELETE' })
  if (r.status !== 200) console.log('xóa user lỗi', u.email, r.status, JSON.stringify(r.data))
}
const fail = results.filter((r) => !r.ok).length
console.log(`\n${results.length - fail}/${results.length} đạt · ảnh: ${OUT}`)
process.exit(fail ? 1 : 0)
