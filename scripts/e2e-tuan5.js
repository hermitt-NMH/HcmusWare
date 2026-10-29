// Kiểm thử end-to-end Tuần 5: MH01–MH08 (mua hàng), AD03–AD06 (quản trị) bằng Edge/Chrome headless.
// Tự tạo tài khoản khách + admin test (email @hcmusware.test), đặt 3 đơn thử, cuối cùng hủy hết đơn
// (trả lại tồn kho) và xóa tài khoản admin test. Cần SUPABASE_SERVICE_ROLE_KEY trong file env.
//
// Cách chạy:
//   Local : npm run build && npm run preview, rồi npm run test:e2e
//           (DB local → tự kiểm thử http://localhost:4173)
//   Vercel: npm run test:e2e:online   (DB online → tự kiểm thử https://hcmusware.vercel.app)
// Ca AD04 chỉ bấm "Xóa" khi tìm đúng 1 dòng mã #id của sản phẩm ĐÃ nằm trong đơn (DB chắc chắn chặn),
// không bao giờ so khớp theo tên (tên "AMD Ryzen 5 7600" trùng một phần với "7600X").
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const SB = process.env.VITE_SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SB || !SERVICE)
  throw new Error('Thiếu VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY: chạy với --env-file')
// Web phải dùng cùng DB với script: DB local → bản preview local, DB online → Vercel.
const IS_LOCAL = /127\.0\.0\.1|localhost/.test(SB)
const BASE = (
  process.env.BASE_URL || (IS_LOCAL ? 'http://localhost:4173' : 'https://hcmusware.vercel.app')
).replace(/\/$/, '')
const OUT = join(import.meta.dirname, '..', 'ui-test-output')
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ---------- Supabase bằng service role (chỉ để chuẩn bị, kiểm tra kho, dọn dẹp) ----------
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
  try {
    return { status: res.status, data: JSON.parse(t) }
  } catch {
    return { status: res.status, data: t }
  }
}
const stockOf = async (id) => (await sb(`/rest/v1/products?id=eq.${id}&select=stock`)).data[0].stock
const ts = Date.now()
const PASS = 'Test1-Qa-' + ts
async function createUser(tag) {
  const email = `test1-${tag}-${ts}@hcmusware.test`
  const r = await sb('/auth/v1/admin/users', {
    method: 'POST',
    body: { email, password: PASS, email_confirm: true },
  })
  if (!r.data.id) throw new Error('Tạo user lỗi: ' + JSON.stringify(r.data))
  return { email, id: r.data.id }
}

// Xóa tài khoản test của lần chạy hỏng trước (chưa có đơn nào)
const old = (await sb('/auth/v1/admin/users?per_page=1000')).data.users ?? []
for (const u of old.filter((u) => /^test1-(khach|admin)-\d+@hcmusware\.test$/.test(u.email))) {
  const n = (await sb(`/rest/v1/orders?select=id&user_id=eq.${u.id}`)).data.length
  // Đơn còn dở của lần chạy trước (script dừng giữa chừng) → hủy để trả kho
  for (const o of (
    await sb(`/rest/v1/orders?select=id&user_id=eq.${u.id}&status=not.in.(completed,cancelled)`)
  ).data)
    await sb(`/rest/v1/orders?id=eq.${o.id}`, { method: 'PATCH', body: { status: 'cancelled' } })
  if (!n && !/khach-/.test(u.email))
    console.log(
      'Xóa user test cũ',
      u.email,
      (await sb(`/auth/v1/admin/users/${u.id}`, { method: 'DELETE' })).status,
    )
}

const customer = await createUser('khach')
const customer2 = await createUser('khach2')
const admin = await createUser('admin')
await sb(`/rest/v1/profiles?id=eq.${admin.id}`, { method: 'PATCH', body: { role: 'admin' } })
console.log('Tài khoản test:', customer.email, '/', admin.email)

const prods = (
  await sb(
    '/rest/v1/products?select=id,name,brand,price,stock,image_url,categories(slug)&stock=gte.10&order=id&limit=2',
  )
).data
const stock0 = Object.fromEntries(prods.map((p) => [p.id, p.stock]))
const cartOf = (list) =>
  JSON.stringify(
    list.map(([p, qty]) => ({
      id: p.id,
      name: p.name,
      brand: p.brand,
      price: p.price,
      image_url: p.image_url,
      slug: p.categories?.slug,
      stock: p.stock,
      qty,
    })),
  )

// ---------- Trình duyệt ----------
// Cùng danh sách trình duyệt với scripts/ui-test.js
const browserPath = [
  process.env.BROWSER,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
]
  .filter(Boolean)
  .find((p) => existsSync(p))
if (!browserPath)
  throw new Error('Không tìm thấy Edge/Chrome. Đặt biến BROWSER=<đường dẫn trình duyệt>.')
const browser = spawn(browserPath, [
  '--headless=new',
  '--remote-debugging-port=9334',
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'e2e-tuan5-'))}`,
  '--no-first-run',
  '--disable-extensions',
  'about:blank',
])
let targets
for (let i = 0; i < 50 && !targets; i++) {
  try {
    targets = await (await fetch('http://127.0.0.1:9334/json')).json()
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
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error')
    consoleErrors.push(m.params.args.map((a) => a.value ?? a.description).join(' '))
  if (m.method === 'Runtime.exceptionThrown')
    consoleErrors.push('EXCEPTION ' + m.params.exceptionDetails.text)
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error')
    consoleErrors.push(`${m.params.entry.text} ${m.params.entry.url ?? ''}`)
  if (m.method === 'Page.javascriptDialogOpening')
    ws.send(
      JSON.stringify({
        id: ++mid,
        method: 'Page.handleJavaScriptDialog',
        params: { accept: true },
      }),
    )
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
await send('Log.enable')
await send('Page.enable')

const text = () => ev('document.body.innerText')
const path = () => ev('location.pathname + location.search')
const hScroll = () =>
  ev('document.documentElement.scrollWidth > document.documentElement.clientWidth')
async function waitFor(expr, ms = 20000) {
  for (let t = 0; t < ms; t += 250) {
    if (await ev(expr)) return true
    await sleep(250)
  }
  return false
}
const notBusy = `document.readyState === 'complete' && !document.querySelector('.animate-pulse') && !/Đang tải|Đang kiểm tra/.test(document.body.innerText)`
async function size(width) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height: 800,
    deviceScaleFactor: 1,
    mobile: width < 600,
  })
}
async function open(p) {
  await send('Page.navigate', { url: BASE + p })
  await sleep(500)
  await waitFor(notBusy)
  await sleep(400)
}
const shot = async (name) => {
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
  if (r.result?.data) writeFileSync(join(OUT, name + '.png'), Buffer.from(r.result.data, 'base64'))
}
// Gõ vào ô React (controlled): đặt value bằng setter gốc rồi bắn sự kiện input/change.
const fillJs = (sel, val) => `(() => {
  const el = ${sel}; if (!el) return false
  const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement : el.tagName === 'SELECT' ? HTMLSelectElement : HTMLInputElement
  Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, ${JSON.stringify(val)})
  el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
  return true })()`
const fieldByLabel = (label) =>
  `[...document.querySelectorAll('label')].find((l) => l.innerText.trim().startsWith(${JSON.stringify(label)}))?.querySelector('input,textarea,select')`
const clickText = (re, tag = 'button,a') =>
  ev(
    `(() => { const b = [...document.querySelectorAll('${tag}')].find((x) => ${re}.test(x.innerText.trim())); if (!b) return false; b.click(); return true })()`,
  )

const results = []
const rec = (code, ok, detail) => {
  results.push({ code, ok })
  console.log(`${ok ? 'ĐẠT ' : 'LỖI '} ${code.padEnd(5)} ${detail}`)
}

async function login(email) {
  await waitFor(`!!document.querySelector('input[type=email]')`)
  await ev(fillJs(`document.querySelector('input[type=email]')`, email))
  await ev(fillJs(`document.querySelector('input[type=password]')`, PASS))
  await ev(`document.querySelector('input[type=email]').form.requestSubmit()`)
  await waitFor(`!location.pathname.startsWith('/dang-nhap')`)
  await sleep(500)
  await waitFor(notBusy)
}
async function setCart(json) {
  await ev(`localStorage.setItem('hcmusware.cart', ${JSON.stringify(json)})`)
}
const orderIdFromPath = async () => Number((await path()).match(/(\d+)/)?.[1])
// Ô gợi ý Tỉnh/Thành, Phường/Xã (Giai đoạn 2 – F17): gõ rồi chọn gợi ý đầu tiên. Trả tên đã chọn.
async function pickSuggestion(inputId, query) {
  await waitFor(`!document.getElementById('${inputId}')?.disabled`)
  await ev(fillJs(`document.getElementById('${inputId}')`, query))
  await waitFor(`!!document.querySelector('#${inputId}-goi-y [role=option]:not([aria-disabled])')`)
  return ev(`(() => {
    const o = document.querySelector('#${inputId}-goi-y [role=option]:not([aria-disabled])')
    o.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
    return o.innerText.trim() })()`)
}

// ===== MH01 – 360px: chưa đăng nhập bấm Thanh toán =====
const [p1, p2] = prods
await size(360)
await open('/')
await setCart(
  cartOf([
    [p1, 2],
    [p2, 1],
  ]),
)
await open('/gio-hang')
await clickText(/^Thanh toán$/)
await waitFor(`location.pathname === '/dang-nhap'`)
const loginPath = await path()
await login(customer.email)
await waitFor(`location.pathname === '/thanh-toan'`)
await waitFor(notBusy)
rec(
  'MH01',
  /next=%2Fthanh-toan/.test(loginPath) && (await path()) === '/thanh-toan' && !(await hScroll()),
  `trang đăng nhập=${loginPath}, sau đăng nhập=${await path()}, cuộn ngang=${await hScroll()}`,
)
await shot('MH01-checkout-360')

// ===== MH02 – để trống tên, SĐT "123" =====
const ordersBefore = (await sb(`/rest/v1/orders?select=id&user_id=eq.${customer.id}`)).data.length
await ev(fillJs(fieldByLabel('Họ tên người nhận'), ''))
await ev(fillJs(fieldByLabel('Số điện thoại'), '123'))
await ev(`document.querySelector('input[name=payment]').form.requestSubmit()`)
await sleep(800)
let t = await text()
const ordersAfter = (await sb(`/rest/v1/orders?select=id&user_id=eq.${customer.id}`)).data.length
rec(
  'MH02',
  /Vui lòng nhập họ tên người nhận/.test(t) &&
    /Số điện thoại không hợp lệ/.test(t) &&
    ordersAfter === ordersBefore,
  `báo thiếu tên=${/Vui lòng nhập họ tên/.test(t)}, báo SĐT sai=${/Số điện thoại không hợp lệ/.test(t)}, số đơn ${ordersBefore}→${ordersAfter}`,
)

// ===== MH03 – online mô phỏng =====
await ev(fillJs(fieldByLabel('Họ tên người nhận'), 'Test1 QA'))
await ev(fillJs(fieldByLabel('Số điện thoại'), '0901234567'))
// Khách mới chưa có sổ địa chỉ → nhập địa chỉ mới bằng gợi ý, "Lưu vào sổ địa chỉ" chọn sẵn.
await pickSuggestion('thanh-toan-tinh', 'ho chi minh')
await pickSuggestion('thanh-toan-xa', 'cho quan')
await ev(fillJs(fieldByLabel('Số nhà và đường'), '227 Nguyễn Văn Cừ'))
await ev(`document.querySelector('input[value=mock_online]').click()`)
await sleep(300)
await ev(`document.querySelector('input[name=payment]').form.requestSubmit()`)
await waitFor(`location.pathname.startsWith('/thanh-toan/mo-phong/')`)
await waitFor(`/HcmusPay/.test(document.body.innerText)`)
const o1 = await orderIdFromPath()
const total1 = p1.price * 2 + p2.price
t = await text()
const cart1 = JSON.parse((await ev(`localStorage.getItem('hcmusware.cart')`)) || '[]')
const s1 = [await stockOf(p1.id), await stockOf(p2.id)]
rec(
  'MH03',
  /HcmusPay/.test(t) &&
    t.includes(total1.toLocaleString('vi-VN')) &&
    cart1.length === 0 &&
    s1[0] === stock0[p1.id] - 2 &&
    s1[1] === stock0[p2.id] - 1,
  `đơn #${o1}, cổng HcmusPay=${/HcmusPay/.test(t)}, số tiền ${total1.toLocaleString('vi-VN')}=${t.includes(total1.toLocaleString('vi-VN'))}, giỏ còn ${cart1.length}, kho ${stock0[p1.id]}→${s1[0]}, ${stock0[p2.id]}→${s1[1]}`,
)
await shot('MH03-hcmuspay-360')

// ===== MH04 – bấm Thanh toán ở cổng =====
await clickText(/^Thanh toán .*₫/)
await waitFor(`/Đặt hàng thành công/.test(document.body.innerText)`)
await waitFor(notBusy)
t = await text()
rec(
  'MH04',
  /Đặt hàng thành công/.test(t) && /Đã xác nhận/.test(t) && /Đã thanh toán/.test(t),
  `thành công=${/Đặt hàng thành công/.test(t)}, Đã xác nhận=${/Đã xác nhận/.test(t)}, Đã thanh toán=${/Đã thanh toán/.test(t)}`,
)

// ===== MH05 – 1366: COD, form điền sẵn =====
await size(1366)
await setCart(cartOf([[p1, 1]]))
await open('/thanh-toan')
// Địa chỉ của đơn MH03 đã vào sổ → trang thanh toán điền sẵn địa chỉ mặc định (US-17.3).
await waitFor(`/Đổi địa chỉ/.test(document.body.innerText)`, 8000)
const preText = await text()
const pre = (preText.match(/(Test1 QA) · (0901234567)/) ?? []).slice(1)
await ev(`document.querySelector('input[name=payment]').form.requestSubmit()`)
await waitFor(`/^\\/don-hang\\/\\d+/.test(location.pathname)`)
await waitFor(notBusy)
const o2 = await orderIdFromPath()
t = await text()
rec(
  'MH05',
  pre[0] === 'Test1 QA' &&
    pre[1] === '0901234567' &&
    /Chờ xác nhận/.test(t) &&
    /Trả khi nhận hàng/.test(t),
  `đơn #${o2}, điền sẵn tên="${pre[0]}" SĐT="${pre[1]}", Chờ xác nhận=${/Chờ xác nhận/.test(t)}, Trả khi nhận hàng=${/Trả khi nhận hàng/.test(t)}`,
)

// ===== MH08 – online, bấm "Để sau" =====
await setCart(cartOf([[p2, 1]]))
await open('/thanh-toan')
await ev(`document.querySelector('input[value=mock_online]').click()`)
await sleep(300)
await ev(`document.querySelector('input[name=payment]').form.requestSubmit()`)
await waitFor(`location.pathname.startsWith('/thanh-toan/mo-phong/')`)
await waitFor(`/HcmusPay/.test(document.body.innerText)`)
const o3 = await orderIdFromPath()
await clickText(/^Để sau/)
await waitFor(`/^\\/don-hang\\/\\d+$/.test(location.pathname)`)
await waitFor(notBusy)
await waitFor(`/Thanh toán ngay/.test(document.body.innerText)`)
t = await text()
rec(
  'MH08',
  /Chờ xác nhận/.test(t) && /Chưa thanh toán/.test(t) && /Thanh toán ngay/.test(t),
  `đơn #${o3}, Chờ xác nhận=${/Chờ xác nhận/.test(t)}, Chưa thanh toán=${/Chưa thanh toán/.test(t)}, nút Thanh toán ngay=${/Thanh toán ngay/.test(t)}`,
)

// ===== MH06 – /tai-khoan =====
await open('/tai-khoan')
const ids = await ev(
  `[...new Set([...document.querySelectorAll('a[href^="/don-hang/"]')].map((a) => a.getAttribute('href')))]`,
)
const expected = [o3, o2, o1].map((i) => `/don-hang/${i}`)
rec(
  'MH06',
  JSON.stringify(ids) === JSON.stringify(expected),
  `link đơn trong tài khoản=${JSON.stringify(ids)} (mong đợi ${JSON.stringify(expected)}, mới nhất trước)`,
)
await shot('MH06-tai-khoan-1366')

// ===== MH07 – đơn của người khác =====
// Khách thứ 2 mở đơn của khách 1
await ev(`localStorage.clear()`)
await open('/dang-nhap')
await login(customer2.email)
await open(`/don-hang/${o1}`)
t = await text()
rec(
  'MH07',
  /404|không tìm thấy/i.test(t) && !/Test1 QA/.test(t),
  `khách 2 mở /don-hang/${o1} của khách 1: trang 404=${/404|không tìm thấy/i.test(t)}, lộ tên người nhận=${/Test1 QA/.test(t)}`,
)

// ===== Đổi sang admin =====
await ev(`localStorage.clear()`)
await open('/dang-nhap')
await login(admin.email)

// ===== AD03 – thông số sai JSON =====
await open('/admin/san-pham')
await clickText(/Thêm sản phẩm/)
await waitFor(`!!${fieldByLabel('Tên sản phẩm')}`)
const adName = `Test1 AD03 ${ts}`
await ev(fillJs(fieldByLabel('Tên sản phẩm'), adName))
await ev(fillJs(fieldByLabel('Giá (VNĐ)'), '1000000'))
await ev(fillJs(fieldByLabel('Tồn kho'), '1'))
await ev(fillJs(fieldByLabel('Thông số (JSON)'), '{socket: AM5}'))
await clickText(/^Lưu$/)
await sleep(1500)
t = await text()
const created = (await sb(`/rest/v1/products?select=id&name=eq.${encodeURIComponent(adName)}`)).data
const specsErr = await ev(
  `(() => { const l = [...document.querySelectorAll('label')].find((l) => l.innerText.startsWith('Thông số')); return l ? l.innerText : '' })()`,
)
rec(
  'AD03',
  /phải là JSON/.test(specsErr) && created.length === 0,
  `lỗi ở ô Thông số="${specsErr.replace(/\n/g, ' | ').slice(0, 120)}", sản phẩm bị tạo=${created.length}`,
)
await shot('AD03-json-sai')
await clickText(/^Hủy$|^Đóng$/)
await ev(`document.querySelector('[aria-label="Đóng"]')?.click()`)

// ===== AD04 – xóa sản phẩm đã có trong đơn =====
const errBefore = consoleErrors.length
await ev(fillJs(`document.querySelector('[aria-label="Tìm sản phẩm"]')`, p1.name))
await sleep(800)
// AN TOÀN: chỉ bấm Xóa khi có ĐÚNG 1 dòng mang mã "#<id> ·" của sản phẩm đã nằm trong đơn.
// (Lần trước so tên bằng "includes" nên "AMD Ryzen 5 7600" khớp nhầm "7600X" → xóa nhầm sản phẩm thật.)
const inOrders =
  (await sb(`/rest/v1/order_items?select=id&product_id=eq.${p1.id}&limit=1`)).data.length === 1
const rowInfo = !inOrders
  ? 'bỏ qua: sản phẩm chưa nằm trong đơn'
  : await ev(`(() => {
  const rows = [...document.querySelectorAll('main ul > li')].filter((r) => r.querySelector('p.text-xs')?.innerText.startsWith('#${p1.id} ·'))
  if (rows.length !== 1) return 'không bấm: tìm thấy ' + rows.length + ' dòng #${p1.id}'
  const b = [...rows[0].querySelectorAll('button')].find((b) => b.innerText.trim() === 'Xóa')
  if (!b) return 'không bấm: không có nút Xóa'
  b.click(); return 'đã bấm Xóa dòng #${p1.id}' })()`)
await sleep(2500)
t = await text()
console.log(
  '   AD04 debug:',
  rowInfo,
  '|',
  (t.match(/.*(xóa|Xóa|đơn hàng).*/g) ?? []).slice(0, 4).join(' / '),
)
await shot('AD04-xoa')
const stillThere = (await sb(`/rest/v1/products?select=id&id=eq.${p1.id}`)).data.length === 1
rec(
  'AD04',
  /đã nằm trong đơn hàng/.test(t) && stillThere && consoleErrors.length === errBefore,
  `báo "đã nằm trong đơn hàng"=${/đã nằm trong đơn hàng/.test(t)}, sản phẩm còn=${stillThere}, lỗi đỏ mới=${consoleErrors.length - errBefore}`,
)

// ===== AD05 – đơn COD: Chờ xác nhận → Đang giao; đơn online chưa trả chỉ được hủy (BUG08) =====
await open('/admin/don-hang')
const cardSel = (id) =>
  `[...document.querySelectorAll('li')].find((li) => li.querySelector('span.font-semibold')?.innerText === '#${id}')`
const opts = (id) =>
  ev(`[...${cardSel(id)}.querySelectorAll('select option')].map((o) => o.innerText)`)
const status = (id) => ev(`${cardSel(id)}.querySelector('select').selectedOptions[0].innerText`)
const setStatus = async (id, value) => {
  await ev(fillJs(`${cardSel(id)}.querySelector('select')`, value))
  await sleep(2500)
}
const optsUnpaid = await opts(o3)
await setStatus(o2, 'confirmed')
await setStatus(o2, 'shipping')
const optsShipping = await opts(o2)
rec(
  'AD05',
  (await status(o2)) === 'Đang giao' &&
    !optsShipping.includes('Chờ xác nhận') &&
    JSON.stringify(optsUnpaid) === JSON.stringify(['Chờ xác nhận', 'Đã hủy']),
  `đơn #${o2} → "${await status(o2)}", lựa chọn còn lại=${JSON.stringify(optsShipping)}; đơn online chưa trả #${o3} chỉ có=${JSON.stringify(optsUnpaid)}`,
)
await shot('AD05-don-hang')

// ===== AD06 – hủy đơn: kho được cộng lại, đơn khóa, đơn đã trả online ghi "cần hoàn tiền" =====
for (const id of [o1, o2, o3]) await setStatus(id, 'cancelled')
t = await text()
const locked = await ev(
  `[${[o1, o2, o3].map((id) => `${cardSel(id)}.querySelector('select').disabled`).join(',')}]`,
)
const paidCard = await ev(`${cardSel(o1)}.innerText`)
const s2 = [await stockOf(p1.id), await stockOf(p2.id)]
rec(
  'AD06',
  locked.every(Boolean) &&
    /cần hoàn tiền/.test(paidCard) &&
    s2[0] === stock0[p1.id] &&
    s2[1] === stock0[p2.id],
  `3 đơn bị khóa=${locked}, đơn #${o1} "cần hoàn tiền"=${/cần hoàn tiền/.test(paidCard)}, kho ${p1.id}: ${stock0[p1.id]}→${s2[0]}, ${p2.id}: ${stock0[p2.id]}→${s2[1]}`,
)

rec(
  'Console',
  consoleErrors.length === 0,
  consoleErrors.length ? consoleErrors.slice(0, 5).join(' || ') : 'không có lỗi đỏ',
)

// ---------- Dọn dẹp ----------
ws.close()
browser.kill()
const left = (await sb(`/rest/v1/orders?select=id,status&user_id=eq.${customer.id}`)).data
for (const o of left.filter((o) => o.status !== 'cancelled' && o.status !== 'completed'))
  await sb(`/rest/v1/orders?id=eq.${o.id}`, { method: 'PATCH', body: { status: 'cancelled' } })
const delAdmin = await sb(`/auth/v1/admin/users/${admin.id}`, { method: 'DELETE' })
await sb(`/auth/v1/admin/users/${customer2.id}`, { method: 'DELETE' })
console.log(
  `\nDọn dẹp: đơn của khách test=${JSON.stringify(left.map((o) => o.id))} đều đã hủy; xóa admin test: ${delAdmin.status}`,
)
console.log(
  `Kho cuối: ${p1.id}=${await stockOf(p1.id)} (đầu ${stock0[p1.id]}), ${p2.id}=${await stockOf(p2.id)} (đầu ${stock0[p2.id]})`,
)
console.log(`${results.filter((r) => r.ok).length}/${results.length} đạt`)
