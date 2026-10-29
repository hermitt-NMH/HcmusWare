// Kiểm thử end-to-end Giai đoạn 2 – Tuần 4 (F16) bằng Edge/Chrome headless, cho 3 vai trò:
//   G4-01      khách chưa mua: không có form đánh giá; đặt câu hỏi có HTML → hiện nguyên văn, không chạy
//   G4-02..03  khách đã nhận hàng: chấm sao + nhận xét, form thành "Sửa đánh giá của bạn";
//              điểm trung bình trên trang sản phẩm, ProductCard và trang shop
//   G4-04..05  người bán: "Câu hỏi chưa trả lời" trong kênh người bán, trả lời có nhãn "Người bán"
//   G4-06..07  admin ẩn đánh giá và câu hỏi (ẩn luôn câu trả lời) → khách không thấy, điểm không tính;
//              admin thấy "Đã ẩn" + "Hiện lại"
//   G4-08      thêm 7 kiểu chèn HTML/script và họ tên có HTML: hiện nguyên văn, không chạy (#105)
// Tự tạo tài khoản, shop, sản phẩm, đơn Hoàn tất (@hcmusware.test); cuối cùng xóa sạch.
//
// Cách chạy:
//   Local : npm run build && npm run preview, rồi npm run test:e2e:g2t4
//   Vercel: npm run db:backup, rồi npm run test:e2e:g2t4:online (DB online → https://hcmusware.vercel.app)
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const SB = process.env.VITE_SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SB || !SERVICE)
  throw new Error('Thiếu VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY: chạy với --env-file')
const IS_LOCAL = /127\.0\.0\.1|localhost/.test(SB)
const BASE = (
  process.env.BASE_URL || (IS_LOCAL ? 'http://localhost:4173' : 'https://hcmusware.vercel.app')
).replace(/\/$/, '')
const OUT = join(import.meta.dirname, '..', 'ui-test-output')
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ---------- Supabase bằng service role (chuẩn bị, kiểm tra, dọn dẹp) ----------
async function sb(path, { method = 'GET', body } = {}) {
  const res = await fetch(SB + path, {
    method,
    headers: {
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
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
const ts = Date.now()
const PASS = 'G2t4-Qa-' + ts
async function createUser(tag, role, fullName) {
  const email = `g2t4-${tag}-${ts}@hcmusware.test`
  const r = await sb('/auth/v1/admin/users', {
    method: 'POST',
    body: { email, password: PASS, email_confirm: true, user_metadata: { full_name: fullName } },
  })
  if (!r.data.id) throw new Error('Tạo user lỗi: ' + JSON.stringify(r.data))
  if (role !== 'customer')
    await sb(`/rest/v1/profiles?id=eq.${r.data.id}`, { method: 'PATCH', body: { role } })
  return { email, id: r.data.id }
}

// Xóa dữ liệu test: đơn → sản phẩm (kéo theo đánh giá, câu hỏi) → shop → tài khoản.
async function cleanupUser(u) {
  const shops = (await sb(`/rest/v1/shops?select=id&owner_id=eq.${u.id}`)).data
  await sb(`/rest/v1/orders?user_id=eq.${u.id}`, { method: 'DELETE' })
  for (const s of shops) {
    await sb(`/rest/v1/orders?shop_id=eq.${s.id}`, { method: 'DELETE' })
    await sb(`/rest/v1/products?shop_id=eq.${s.id}`, { method: 'DELETE' })
    await sb(`/rest/v1/shops?id=eq.${s.id}`, { method: 'DELETE' })
  }
  return (await sb(`/auth/v1/admin/users/${u.id}`, { method: 'DELETE' })).status
}
const old = (await sb('/auth/v1/admin/users?per_page=1000')).data.users ?? []
for (const u of old.filter((u) => /^g2t4-[a-z]+-\d+@hcmusware\.test$/.test(u.email)))
  console.log('Xóa dữ liệu test cũ', u.email, await cleanupUser(u))

const buyer = await createUser('mua', 'customer', 'Trần Thị Bích Ngọc')
const visitor = await createUser('khach', 'customer', 'Lê Văn Hỏi')
const seller = await createUser('ban', 'seller', 'Phạm Bán Hàng')
const admin = await createUser('admin', 'admin', 'Quản Trị G2T4')
// Họ tên có HTML: tên hiện dưới câu hỏi cũng phải là chữ thường (#105)
const hacker = await createUser('xss', 'customer', '<img src=y onerror=alert(7)>Hắc Cơ')
const users = [buyer, visitor, seller, admin, hacker]
console.log('Tài khoản test:', users.map((u) => u.email).join(', '))

const cpuCat = (await sb('/rest/v1/categories?select=id&slug=eq.cpu')).data[0].id
const shop = (
  await sb('/rest/v1/shops', {
    method: 'POST',
    body: { owner_id: seller.id, name: `Shop G2T4 ${ts}`, slug: `g2t4-${ts}`, status: 'active' },
  })
).data[0]
const product = (
  await sb('/rest/v1/products', {
    method: 'POST',
    body: {
      category_id: cpuCat,
      name: `CPU thử G2T4 ${ts}`,
      brand: 'AMD',
      price: 3000000,
      stock: 5,
      specs: { socket: 'AM5', tdp_w: 65, igpu: true },
      shop_id: shop.id,
      status: 'active',
    },
  })
).data[0]
// Đơn đã giao (Hoàn tất) của người mua → được đánh giá.
const order = (
  await sb('/rest/v1/orders', {
    method: 'POST',
    body: {
      user_id: buyer.id,
      shop_id: shop.id,
      status: 'completed',
      total: product.price,
      shipping_name: 'G2T4 QA',
      shipping_phone: '0901234567',
      shipping_address: '227 Nguyễn Văn Cừ, Phường Chợ Quán, TP.HCM',
    },
  })
).data[0]
await sb('/rest/v1/order_items', {
  method: 'POST',
  body: { order_id: order.id, product_id: product.id, quantity: 1, unit_price: product.price },
})

const PRODUCT_PAGE = `/san-pham/${product.id}`
const XSS_QUESTION = '<img src=x onerror=alert(1)> Còn hàng không shop?'
const XSS_REVIEW = '<script>alert(2)</script>\n\n\n\nChạy mát, đáng tiền.'
const SELLER_REPLY = 'Còn 5 chiếc, bạn đặt ngay nhé.'

// ---------- Trình duyệt (cùng cách với scripts/e2e-g2t3.js) ----------
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
  '--remote-debugging-port=9336',
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'e2e-g2t4-'))}`,
  '--no-first-run',
  '--disable-extensions',
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
const dialogs = [] // hộp thoại alert() bật lên = nội dung người dùng bị chạy như code (US-16.5)
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
  if (m.method === 'Page.javascriptDialogOpening') {
    dialogs.push(m.params.message)
    ws.send(
      JSON.stringify({
        id: ++mid,
        method: 'Page.handleJavaScriptDialog',
        params: { accept: true },
      }),
    )
  }
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

const text = () => ev('document.body.innerText')
async function waitFor(expr, ms = 20000) {
  for (let t = 0; t < ms; t += 250) {
    if (await ev(expr)) return true
    await sleep(250)
  }
  return false
}
const notBusy = `document.readyState === 'complete' && !document.querySelector('.animate-pulse') && !/Đang tải|Đang kiểm tra/.test(document.body.innerText)`
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
const fillJs = (sel, val) => `(() => {
  const el = ${sel}; if (!el) return false
  const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement : HTMLInputElement
  Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, ${JSON.stringify(val)})
  el.dispatchEvent(new Event('input', { bubbles: true }))
  return true })()`

// Mục đánh giá / hỏi đáp tìm theo id của tiêu đề (reviews-title, questions-title).
const sectionJs = (id) => `document.getElementById(${JSON.stringify(id)})?.closest('section')`
const section = (id) => ev(`${sectionJs(id)}?.innerText ?? ''`)
const textareaIn = (id) => `${sectionJs(id)}?.querySelector('textarea')`
const submitIn = (id) => ev(`${textareaIn(id)}.form.requestSubmit()`)
const clickIn = (id, label) =>
  ev(
    `[...${sectionJs(id)}.querySelectorAll('button')].find((b) => b.innerText.trim() === ${JSON.stringify(label)})?.click()`,
  )
const sectionHas = (id, re) => `${re}.test(${sectionJs(id)}?.innerText ?? '')`

const results = []
const rec = (code, ok, detail) => {
  results.push({ code, ok })
  console.log(`${ok ? 'ĐẠT ' : 'LỖI '} ${code.padEnd(7)} ${detail}`)
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
async function logout() {
  await ev('localStorage.clear()')
  await open('/')
}
async function loginAs(u, next) {
  await logout()
  await open(`/dang-nhap?next=${encodeURIComponent(next)}`)
  await login(u.email)
  await waitFor(`location.pathname === ${JSON.stringify(next)}`)
  await waitFor(notBusy)
  await sleep(400)
}

try {
  await send('Emulation.setDeviceMetricsOverride', {
    width: 360,
    height: 800,
    deviceScaleFactor: 1,
    mobile: true,
  })

  // ===== G4-01 – khách chưa mua: không có form; hỏi có HTML → hiện nguyên văn =====
  await loginAs(visitor, PRODUCT_PAGE)
  let reviews = await section('reviews-title')
  const noForm =
    /Chỉ người đã nhận hàng mới đánh giá được/.test(reviews) &&
    !(await ev(`!!document.querySelector('input[name=rating]')`))
  await ev(fillJs(textareaIn('questions-title'), XSS_QUESTION))
  await submitIn('questions-title')
  await waitFor(
    `${sectionJs('questions-title')}.innerText.includes(${JSON.stringify(XSS_QUESTION)})`,
  )
  await sleep(500)
  let questions = await section('questions-title')
  const injectedImg = await ev(`!!document.querySelector('img[src="x"]')`)
  rec(
    'G4-01',
    noForm &&
      questions.includes(XSS_QUESTION) &&
      /Lê V\. H\./.test(questions) &&
      !injectedImg &&
      dialogs.length === 0,
    `không có form đánh giá=${noForm}; câu hỏi hiện nguyên văn=${questions.includes(XSS_QUESTION)}, tên rút gọn "Lê V. H."=${/Lê V\. H\./.test(questions)}; có thẻ <img src=x>=${injectedImg}; hộp thoại bật lên=${dialogs.length}`,
  )
  await shot('G4-01-hoi-dap-khach-360')

  // ===== G4-02 – người đã nhận hàng đánh giá =====
  await loginAs(buyer, PRODUCT_PAGE)
  await waitFor(`!!document.querySelector('input[name=rating]')`)
  await ev(`document.querySelector('input[name=rating][value="4"]').click()`)
  await ev(fillJs(textareaIn('reviews-title'), XSS_REVIEW))
  await submitIn('reviews-title')
  await waitFor(sectionHas('reviews-title', '/Sửa đánh giá của bạn/'))
  await sleep(300)
  reviews = await section('reviews-title')
  const literal = reviews.includes('<script>alert(2)</script>\n\nChạy mát, đáng tiền.')
  const saved = (
    await sb(`/rest/v1/reviews?select=rating,comment,author_name&product_id=eq.${product.id}`)
  ).data
  rec(
    'G4-02',
    /4,0 ★ \(1\)/.test(reviews) &&
      /Đã mua hàng/.test(reviews) &&
      /Trần T\. B\. N\./.test(reviews) &&
      /Sửa đánh giá của bạn/.test(reviews) &&
      literal &&
      saved.length === 1 &&
      saved[0].rating === 4 &&
      dialogs.length === 0,
    `điểm "4,0 ★ (1)"=${/4,0 ★ \(1\)/.test(reviews)}, nhãn "Đã mua hàng"=${/Đã mua hàng/.test(reviews)}, tên "${saved[0]?.author_name}"; nhận xét nguyên văn, gộp dòng trống=${literal}; form → "Sửa đánh giá của bạn"=${/Sửa đánh giá của bạn/.test(reviews)}; DB: ${saved.length} đánh giá ${saved[0]?.rating} sao; hộp thoại=${dialogs.length}`,
  )
  await shot('G4-02-danh-gia-360')

  // ===== G4-03 – điểm trung bình trên trang shop và ProductCard =====
  await open(`/shop/${shop.slug}`)
  await waitFor(`/4,0 ★ \\(1\\)/.test(document.body.innerText)`)
  let t = await text()
  const card = await ev(
    `[...document.querySelectorAll('a[href="/san-pham/${product.id}"]')].map((a) => a.innerText).join(' ')`,
  )
  rec(
    'G4-03',
    /4,0 ★ \(1\)/.test(t) && /★\s*4,0 \(1\)/.test(card),
    `trang shop "4,0 ★ (1)"=${/4,0 ★ \(1\)/.test(t)}; ProductCard "★ 4,0 (1)"=${/★\s*4,0 \(1\)/.test(card)}`,
  )

  // ===== G4-04 – người bán thấy câu hỏi chưa trả lời, trả lời từ kênh người bán =====
  await loginAs(seller, '/kenh-nguoi-ban/cau-hoi')
  t = await text()
  const listed = t.includes(XSS_QUESTION) && t.includes(product.name)
  await shot('G4-04-cau-hoi-chua-tra-loi-360')
  await ev(fillJs(`document.querySelector('main textarea')`, SELLER_REPLY))
  await ev(`document.querySelector('main textarea').form.requestSubmit()`)
  await waitFor(`/Không còn câu hỏi nào chưa trả lời/.test(document.body.innerText)`)
  const emptied = /Không còn câu hỏi nào chưa trả lời/.test(await text())
  rec(
    'G4-04',
    listed && emptied,
    `kênh người bán liệt kê câu hỏi=${listed}; trả lời xong danh sách trống=${emptied}`,
  )

  // ===== G4-05 – câu trả lời có nhãn "Người bán" trên trang sản phẩm =====
  await open(PRODUCT_PAGE)
  await waitFor(
    `${sectionJs('questions-title')}.innerText.includes(${JSON.stringify(SELLER_REPLY)})`,
  )
  questions = await section('questions-title')
  const sellerLabel = new RegExp(`${shop.name}\\s*Người bán`).test(questions)
  rec(
    'G4-05',
    sellerLabel && questions.includes(SELLER_REPLY),
    `trả lời hiện dưới câu hỏi=${questions.includes(SELLER_REPLY)}, tên shop + nhãn "Người bán"=${sellerLabel}`,
  )

  // ===== G4-06 – admin ẩn đánh giá và câu hỏi =====
  await loginAs(admin, PRODUCT_PAGE)
  await waitFor(sectionHas('questions-title', /Còn 5 chiếc/))
  await clickIn('reviews-title', 'Ẩn')
  await waitFor(sectionHas('reviews-title', '/Hiện lại/'))
  // Nút "Ẩn" đầu tiên trong mục hỏi đáp là của câu hỏi
  await clickIn('questions-title', 'Ẩn')
  await waitFor(sectionHas('questions-title', '/Hiện lại/'))
  await sleep(300)
  reviews = await section('reviews-title')
  questions = await section('questions-title')
  const hiddenInDb = (await sb(`/rest/v1/comments?select=hidden&product_id=eq.${product.id}`)).data
  rec(
    'G4-06',
    /Đã ẩn/.test(reviews) &&
      /Chưa có đánh giá/.test(reviews) &&
      /Đã ẩn/.test(questions) &&
      questions.includes(SELLER_REPLY) &&
      hiddenInDb.filter((c) => c.hidden).length === 1,
    `admin: đánh giá "Đã ẩn"=${/Đã ẩn/.test(reviews)}, điểm → "Chưa có đánh giá"=${/Chưa có đánh giá/.test(reviews)}; câu hỏi "Đã ẩn"=${/Đã ẩn/.test(questions)}, admin vẫn thấy câu trả lời=${questions.includes(SELLER_REPLY)}; DB ẩn ${hiddenInDb.filter((c) => c.hidden).length}/${hiddenInDb.length} bình luận (chỉ câu hỏi)`,
  )
  await shot('G4-06-admin-an-360')

  // ===== G4-07 – khách không còn thấy nội dung đã ẩn =====
  await logout()
  await open(PRODUCT_PAGE)
  t = await text()
  rec(
    'G4-07',
    !t.includes('Chạy mát') &&
      !t.includes('Còn hàng không shop?') &&
      !t.includes(SELLER_REPLY) &&
      /Chưa có đánh giá/.test(t) &&
      /Đăng nhập để hỏi/.test(t),
    `chưa đăng nhập: thấy đánh giá đã ẩn=${t.includes('Chạy mát')}, câu hỏi=${t.includes('Còn hàng không shop?')}, câu trả lời=${t.includes(SELLER_REPLY)}; nút "Đăng nhập để hỏi"=${/Đăng nhập để hỏi/.test(t)}`,
  )

  // ===== G4-08 – thêm các kiểu chèn HTML/script (Test1, #105) =====
  const XSS_MORE = [
    '<svg onload=alert(3)>',
    '<a href="javascript:alert(4)">bấm vào đây</a>',
    '<iframe src="javascript:alert(5)"></iframe>',
    '"><script>alert(6)</script>',
    "'; alert(8); //",
    '[link](javascript:alert(9))',
    '&lt;b&gt;in đậm&lt;/b&gt; &amp;',
  ].join('\n')
  await loginAs(hacker, PRODUCT_PAGE)
  await ev(fillJs(textareaIn('questions-title'), XSS_MORE))
  await submitIn('questions-title')
  await waitFor(`${sectionJs('questions-title')}.innerText.includes('[link](javascript:alert(9))')`)
  await sleep(800)
  questions = await section('questions-title')
  const injected = await ev(
    `(() => { const s = ${sectionJs('questions-title')}; return [...s.querySelectorAll('svg[onload], iframe, script, img[src="y"], a[href^="javascript"]')].map((e) => e.outerHTML.slice(0, 40)) })()`,
  )
  const allLiteral = XSS_MORE.split('\n').every((line) => questions.includes(line))
  // Tên hiển thị do DB rút gọn từ họ tên; phải hiện đúng chuỗi đó dạng chữ thường
  const hackerName = (await sb(`/rest/v1/comments?select=author_name&user_id=eq.${hacker.id}`))
    .data[0]?.author_name
  const nameLiteral = !!hackerName && questions.includes(hackerName)
  rec(
    'G4-08',
    allLiteral && nameLiteral && injected.length === 0 && dialogs.length === 0,
    `7 kiểu chèn hiện nguyên văn=${allLiteral}; họ tên có HTML hiện "${hackerName}" dạng chữ=${nameLiteral}; thẻ lạ trong mục hỏi đáp=${injected.length ? JSON.stringify(injected) : 0}; hộp thoại=${dialogs.length}`,
  )
  await shot('G4-08-chen-html-360')

  // Ảnh chế độ tối trên máy tính để soát bằng mắt (Definition of Done: đọc rõ ở cả 2 chế độ)
  await sb(`/rest/v1/reviews?product_id=eq.${product.id}`, {
    method: 'PATCH',
    body: { hidden: false },
  })
  await sb(`/rest/v1/comments?product_id=eq.${product.id}`, {
    method: 'PATCH',
    body: { hidden: false },
  })
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  })
  await ev(`localStorage.setItem('hcmusware.theme', 'dark')`)
  await open(PRODUCT_PAGE)
  await shot('G4-09-trang-san-pham-toi-1280')

  rec(
    'Console',
    consoleErrors.length === 0,
    consoleErrors.length ? `lỗi đỏ: ${consoleErrors.join(' | ')}` : 'không có lỗi đỏ',
  )
} finally {
  browser.kill()
  console.log(`\nDọn dẹp: ${(await Promise.all(users.map(cleanupUser))).join(', ')}`)
}
const passed = results.filter((r) => r.ok).length
console.log(`${passed}/${results.length} đạt`)
process.exit(passed === results.length ? 0 : 1)
