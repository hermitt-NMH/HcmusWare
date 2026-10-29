// Kiểm thử end-to-end Giai đoạn 2 – Tuần 2 (luồng của Test1, thẻ #91) bằng Edge/Chrome headless:
//   G2-01..02  khách mở shop (360 px): bỏ trống / chưa đồng ý quy định bị chặn; logo; đăng ký → "Chờ admin duyệt"
//   G2-03..04  admin từ chối shop phải có lý do (1366 px); khách thấy lý do, sửa và gửi lại
//   G2-05      admin duyệt shop → chủ shop có vai trò người bán và Kênh người bán
//   G2-06..07  người bán đăng sản phẩm (360 px): bỏ trống báo lỗi; ảnh sai loại / quá 2 MB bị chặn;
//              giá "3.490.000" lưu đúng 3490000 (BUG-G2T2-01); chờ duyệt thì khách chưa thấy
//   G2-08..09  admin trả lại sản phẩm có lý do; người bán thấy lý do, sửa và gửi duyệt lại
//   G2-10..11  admin duyệt → sản phẩm có ảnh hiện trên web, trang shop, chọn được trong Build PC
//   G2-12      không tràn ngang ở 360 px; ảnh chế độ tối để soát bằng mắt
// Tự tạo khách và admin thử (@hcmusware.test); cuối cùng xóa shop, sản phẩm, ảnh và tài khoản.
//
// Cách chạy:
//   Local : npm run build && npm run preview, rồi npm run test:e2e:g2t2
//   Vercel: npm run test:e2e:g2t2:online (DB online → https://hcmusware.vercel.app)
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { deflateSync } from 'node:zlib'

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
const PASS = 'G2t2-Qa-' + ts
async function createUser(tag, role, fullName) {
  const email = `g2t2-${tag}-${ts}@hcmusware.test`
  const r = await sb('/auth/v1/admin/users', {
    method: 'POST',
    body: { email, password: PASS, email_confirm: true, user_metadata: { full_name: fullName } },
  })
  if (!r.data.id) throw new Error('Tạo user lỗi: ' + JSON.stringify(r.data))
  if (role !== 'customer')
    await sb(`/rest/v1/profiles?id=eq.${r.data.id}`, { method: 'PATCH', body: { role } })
  return { email, id: r.data.id }
}

// Xóa dữ liệu test: ảnh trong thư mục shop → sản phẩm → shop → tài khoản.
async function cleanupUser(u) {
  const shops = (await sb(`/rest/v1/shops?select=id&owner_id=eq.${u.id}`)).data
  for (const s of shops) {
    const files = (
      await sb('/storage/v1/object/list/product-images', {
        method: 'POST',
        body: { prefix: `${s.id}/`, limit: 100 },
      })
    ).data
    if (Array.isArray(files) && files.length)
      await sb('/storage/v1/object/product-images', {
        method: 'DELETE',
        body: { prefixes: files.map((f) => `${s.id}/${f.name}`) },
      })
    await sb(`/rest/v1/products?shop_id=eq.${s.id}`, { method: 'DELETE' })
    await sb(`/rest/v1/shops?id=eq.${s.id}`, { method: 'DELETE' })
  }
  return (await sb(`/auth/v1/admin/users/${u.id}`, { method: 'DELETE' })).status
}
const old = (await sb('/auth/v1/admin/users?per_page=1000')).data.users ?? []
for (const u of old.filter((u) => /^g2t2-[a-z]+-\d+@hcmusware\.test$/.test(u.email)))
  console.log('Xóa dữ liệu test cũ', u.email, await cleanupUser(u))

const owner = await createUser('chu', 'customer', 'Võ Chủ Shop')
const admin = await createUser('admin', 'admin', 'Quản Trị G2T2')
const users = [owner, admin]
console.log('Tài khoản test:', users.map((u) => u.email).join(', '))

const SHOP_NAME = `Shop G2T2 ${ts}`
const PRODUCT_NAME = `CPU thử G2T2 ${ts}`
const REJECT_SHOP = 'Mô tả chưa ghi địa chỉ bảo hành.'
const REJECT_PRODUCT = 'Ảnh mờ, chụp lại giúp mình.'

// ---------- File ảnh thử: PNG 64×64 hợp lệ, PNG 2,2 MB, file HTML ----------
function png(size, extraBytes = 0) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  })
  const crc = (buf) => {
    let c = 0xffffffff
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const td = Buffer.concat([Buffer.from(type), data])
    const c = Buffer.alloc(4)
    c.writeUInt32BE(crc(td))
    return Buffer.concat([len, td, c])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // 8 bit
  ihdr[9] = 2 // RGB
  const rows = []
  for (let y = 0; y < size; y++) {
    rows.push(0)
    for (let x = 0; x < size; x++) rows.push((x * 4) & 255, (y * 4) & 255, 160)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.from(rows))),
    // Chunk phụ (bỏ qua khi hiển thị) để làm file nặng hơn 2 MB
    ...(extraBytes ? [chunk('tEXt', Buffer.alloc(extraBytes, 65))] : []),
    chunk('IEND', Buffer.alloc(0)),
  ])
}
const FILES = mkdtempSync(join(tmpdir(), 'e2e-g2t2-files-'))
const IMG_OK = join(FILES, 'cpu-g2t2.png')
const IMG_BIG = join(FILES, 'anh-qua-lon.png')
const NOT_IMG = join(FILES, 'khong-phai-anh.html')
writeFileSync(IMG_OK, png(64))
writeFileSync(IMG_BIG, png(8, 2.2 * 1024 * 1024))
writeFileSync(NOT_IMG, '<h1>không phải ảnh</h1>')

// ---------- Trình duyệt (cùng cách với scripts/e2e-g2t4.js) ----------
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
  '--remote-debugging-port=9337',
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'e2e-g2t2-'))}`,
  '--no-first-run',
  '--disable-extensions',
  'about:blank',
])
let targets
for (let i = 0; i < 50 && !targets; i++) {
  try {
    targets = await (await fetch('http://127.0.0.1:9337/json')).json()
  } catch {
    await sleep(200)
  }
}
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl)
await new Promise((r) => (ws.onopen = r))
let mid = 0
const pending = new Map()
const consoleErrors = []
const dialogs = []
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
await send('DOM.enable')

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
  const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement : el.tagName === 'SELECT' ? HTMLSelectElement : HTMLInputElement
  Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, ${JSON.stringify(val)})
  el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
  return true })()`
const fill = (id, val) => ev(fillJs(`document.getElementById(${JSON.stringify(id)})`, val))
const has = (re) => ev(`${re}.test(document.body.innerText)`)
const clickText = (label, scope = 'document') =>
  ev(
    `!!([...${scope}.querySelectorAll('button, a')].find((b) => b.innerText.trim() === ${JSON.stringify(label)})?.click() ?? 0)`,
  )
// Thẻ <li> trên trang duyệt của admin có chứa tên (shop hoặc sản phẩm).
const itemJs = (name) =>
  `[...document.querySelectorAll('main li')].find((li) => li.innerText.includes(${JSON.stringify(name)}))`
// Chọn file cho <input type=file> (kể cả ô bị ẩn) như người dùng chọn trong hộp thoại.
async function pickFiles(selector, paths) {
  const doc = await send('DOM.getDocument', { depth: 0 })
  const q = await send('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector })
  await send('DOM.setFileInputFiles', { nodeId: q.result.nodeId, files: paths })
  await sleep(300)
}
const noHorizontalScroll = () => ev('document.documentElement.scrollWidth <= window.innerWidth + 1')
async function viewport(width, height, mobile) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile,
  })
}

const results = []
const rec = (code, ok, detail) => {
  results.push({ code, ok })
  console.log(`${ok ? 'ĐẠT ' : 'LỖI '} ${code.padEnd(6)} ${detail}`)
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
  await ev('localStorage.removeItem(Object.keys(localStorage).find((k) => k.includes("auth")))')
  await open('/')
}
async function loginAs(u, next) {
  await logout()
  await open(`/dang-nhap?next=${encodeURIComponent(next)}`)
  await login(u.email)
  await waitFor(`location.pathname + location.search === ${JSON.stringify(next)}`)
  await waitFor(notBusy)
  await sleep(400)
}
const myShop = async () =>
  (await sb(`/rest/v1/shops?select=id,slug,status,review_note,name&owner_id=eq.${owner.id}`))
    .data[0]
const myProduct = async (shopId) =>
  (
    await sb(
      `/rest/v1/products?select=id,name,price,stock,status,images,review_note,specs&shop_id=eq.${shopId}`,
    )
  ).data[0]
const overflow = {} // trang → không tràn ngang ở 360 px

try {
  // ===== G2-01 – khách mở shop: bỏ trống / chưa đồng ý bị chặn =====
  await viewport(360, 800, true)
  await loginAs(owner, '/tai-khoan/mo-shop')
  await waitFor(`!!document.getElementById('shop-name')`)
  await ev(`document.getElementById('shop-name').form.requestSubmit()`)
  await sleep(300)
  const emptyBlocked =
    (await ev(`document.getElementById('shop-name').getAttribute('aria-invalid') === 'true'`)) &&
    (await ev(`document.activeElement?.id === 'shop-name'`))
  await fill('shop-name', SHOP_NAME)
  await ev(`document.getElementById('shop-name').form.requestSubmit()`)
  await sleep(300)
  const agreeBlocked = !!(await ev(`document.getElementById('shop-agree-error')?.innerText`))
  const noShopYet = !(await myShop())
  rec(
    'G2-01',
    emptyBlocked && agreeBlocked && noShopYet,
    `bỏ trống tên: báo lỗi + con trỏ về ô tên=${emptyBlocked}; chưa tick đồng ý: báo lỗi=${agreeBlocked}; chưa tạo shop=${noShopYet}`,
  )
  overflow['mo-shop'] = await noHorizontalScroll()
  await shot('G2-01-mo-shop-360')

  // ===== G2-02 – gửi đăng ký có logo → "Chờ admin duyệt" =====
  await fill('shop-description', 'Linh kiện chính hãng.\nBảo hành 36 tháng.')
  await ev(`document.getElementById('shop-agree').click()`)
  await pickFiles('input[type=file]', [IMG_OK])
  const logoPreview = await ev(`!!document.querySelector('img[alt="Logo shop"]')`)
  await ev(`document.getElementById('shop-name').form.requestSubmit()`)
  await waitFor(`location.pathname === '/tai-khoan'`)
  await waitFor(notBusy)
  let t = await text()
  let shop = await myShop()
  rec(
    'G2-02',
    logoPreview &&
      /Đã gửi đăng ký shop/.test(t) &&
      /Chờ admin duyệt/.test(t) &&
      shop?.status === 'pending',
    `xem trước logo=${logoPreview}; thông báo "Đã gửi đăng ký shop"=${/Đã gửi đăng ký shop/.test(t)}; tài khoản hiện "Chờ admin duyệt"=${/Chờ admin duyệt/.test(t)}; DB status=${shop?.status}`,
  )
  overflow['tai-khoan'] = await noHorizontalScroll()

  // ===== G2-03 – admin từ chối shop: phải có lý do =====
  await viewport(1366, 900, false)
  await loginAs(admin, '/admin/duyet')
  await waitFor(`!!${itemJs(SHOP_NAME)}`)
  await clickText('Từ chối', itemJs(SHOP_NAME))
  await waitFor(`!!document.querySelector('main textarea')`)
  await ev(`document.querySelector('main textarea').form.requestSubmit()`)
  await sleep(300)
  const needReason = await has('/Nhập lý do\\./')
  await ev(fillJs(`document.querySelector('main textarea')`, REJECT_SHOP))
  await ev(`document.querySelector('main textarea').form.requestSubmit()`)
  await waitFor(`/Đã từ chối shop/.test(document.body.innerText)`)
  shop = await myShop()
  rec(
    'G2-03',
    needReason && shop.status === 'rejected' && shop.review_note === REJECT_SHOP,
    `gửi trống báo "Nhập lý do."=${needReason}; DB status=${shop.status}, lý do="${shop.review_note}"`,
  )

  // ===== G2-04 – khách thấy lý do, sửa và gửi lại =====
  await viewport(360, 800, true)
  await loginAs(owner, '/tai-khoan/mo-shop')
  t = await text()
  const seesReason = t.includes(REJECT_SHOP) && /Bị từ chối/.test(t)
  await fill('shop-description', 'Linh kiện chính hãng.\nBảo hành tại 227 Nguyễn Văn Cừ, Q5.')
  await ev(`document.getElementById('shop-name').form.requestSubmit()`)
  await waitFor(`location.pathname === '/tai-khoan'`)
  shop = await myShop()
  rec(
    'G2-04',
    seesReason && shop.status === 'pending' && shop.review_note == null,
    `khách thấy "Bị từ chối" + lý do=${seesReason}; gửi lại → DB status=${shop.status}, lý do cũ xóa=${shop.review_note == null}`,
  )

  // ===== G2-05 – admin duyệt shop → chủ shop là người bán =====
  await viewport(1366, 900, false)
  await loginAs(admin, '/admin/duyet')
  await waitFor(`!!${itemJs(SHOP_NAME)}`)
  await clickText('Duyệt', itemJs(SHOP_NAME))
  await waitFor(`/Đã duyệt shop/.test(document.body.innerText)`)
  shop = await myShop()
  const role = (await sb(`/rest/v1/profiles?select=role&id=eq.${owner.id}`)).data[0]?.role
  await viewport(360, 800, true)
  await loginAs(owner, '/kenh-nguoi-ban')
  t = await text()
  const channel = t.includes(SHOP_NAME) && !/Không có quyền truy cập/.test(t)
  rec(
    'G2-05',
    shop.status === 'active' && role === 'seller' && channel,
    `DB shop=${shop.status}, vai trò=${role}; vào được Kênh người bán, thấy tên shop=${channel}`,
  )
  overflow['kenh-nguoi-ban'] = await noHorizontalScroll()

  // ===== G2-06 – đăng sản phẩm: bỏ trống báo lỗi; ảnh sai loại / quá 2 MB bị chặn =====
  await open('/kenh-nguoi-ban/san-pham/moi')
  await waitFor(`!!document.getElementById('f-category_id')`)
  await ev(`document.getElementById('f-category_id').form.requestSubmit()`)
  await sleep(400)
  const firstInvalid = await ev(`document.activeElement?.id`)
  const invalidCount = await ev(`document.querySelectorAll('[aria-invalid="true"]').length`)
  const cpuId = String((await sb('/rest/v1/categories?select=id&slug=eq.cpu')).data[0].id)
  await fill('f-category_id', cpuId)
  await waitFor(`!!document.getElementById('f-specs-socket')`)
  await pickFiles('input[type=file]', [NOT_IMG])
  const wrongType = await has('/phải là JPG, PNG hoặc WebP/')
  await pickFiles('input[type=file]', [IMG_BIG])
  const tooBig = await has('/lớn hơn 2 MB/')
  rec(
    'G2-06',
    firstInvalid === 'f-category_id' && invalidCount >= 3 && wrongType && tooBig,
    `bỏ trống: ${invalidCount} ô báo lỗi, con trỏ về ô "${firstInvalid}"; file HTML bị chặn=${wrongType}; ảnh 2,2 MB bị chặn=${tooBig}`,
  )

  // ===== G2-07 – điền đủ, giá "3.490.000" → lưu 3490000, chờ duyệt =====
  await fill('f-name', PRODUCT_NAME)
  const amd = await ev(
    `[...document.getElementById('f-brand_id').options].find((o) => o.text === 'AMD')?.value`,
  )
  await fill('f-brand_id', amd)
  await fill('f-price', '3.490.000')
  await fill('f-stock', '7')
  await fill('f-description', '<b>6 nhân 12 luồng</b>, kèm tản nhiệt.')
  await fill('f-specs-socket', 'AM5')
  await fill('f-specs-cores', '6')
  await fill('f-specs-threads', '12')
  await fill('f-specs-base_clock_ghz', '3,8')
  await fill('f-specs-boost_clock_ghz', '5.1')
  await fill('f-specs-tdp_w', '65')
  await fill('f-specs-igpu', 'true')
  await pickFiles('input[type=file]', [IMG_OK])
  await waitFor(`!/Đang tải…/.test(document.body.innerText)`)
  await sleep(500)
  overflow['san-pham-moi'] = await noHorizontalScroll()
  await shot('G2-07-dang-san-pham-360')
  await ev(`document.getElementById('f-name').form.requestSubmit()`)
  await waitFor(`location.pathname === '/kenh-nguoi-ban'`)
  await waitFor(notBusy)
  t = await text()
  let product = await myProduct(shop.id)
  const formErrors = await ev(
    `[...document.querySelectorAll('[id$="-error"]')].map((e) => e.innerText).join(' | ')`,
  )
  await logout()
  await open(`/san-pham/${product?.id}`)
  const hiddenFromPublic = !(await has(`/${PRODUCT_NAME}/`))
  rec(
    'G2-07',
    /chờ admin duyệt/.test(t) &&
      product?.status === 'pending' &&
      product.price === 3490000 &&
      product.stock === 7 &&
      product.images?.length === 1 &&
      product.specs?.base_clock_ghz === 3.8 &&
      hiddenFromPublic,
    `thông báo chờ duyệt=${/chờ admin duyệt/.test(t)}; DB: status=${product?.status}, giá=${product?.price}, kho=${product?.stock}, ${product?.images?.length} ảnh, xung "3,8"→${product?.specs?.base_clock_ghz}; khách chưa thấy=${hiddenFromPublic}${formErrors ? `; lỗi form: ${formErrors}` : ''}`,
  )

  // ===== G2-08 – admin trả lại sản phẩm có lý do =====
  await viewport(1366, 900, false)
  await loginAs(admin, '/admin/duyet?tab=san-pham')
  await waitFor(`!!${itemJs(PRODUCT_NAME)}`)
  await clickText('Trả lại', itemJs(PRODUCT_NAME))
  await waitFor(`!!document.querySelector('main textarea')`)
  await ev(fillJs(`document.querySelector('main textarea')`, REJECT_PRODUCT))
  await ev(`document.querySelector('main textarea').form.requestSubmit()`)
  await waitFor(`/Đã trả lại/.test(document.body.innerText)`)
  product = await myProduct(shop.id)
  rec(
    'G2-08',
    product.status === 'hidden' && product.review_note === REJECT_PRODUCT,
    `DB status=${product.status}, lý do="${product.review_note}"`,
  )

  // ===== G2-09 – người bán thấy lý do, sửa và gửi duyệt lại =====
  await viewport(360, 800, true)
  await loginAs(owner, '/kenh-nguoi-ban')
  t = await text()
  const sellerSeesReason = t.includes(REJECT_PRODUCT)
  await open(`/kenh-nguoi-ban/san-pham/${product.id}`)
  await waitFor(`!!document.getElementById('f-name')`)
  const resubmitLabel = await has('/Lưu và gửi duyệt lại/')
  await pickFiles('input[type=file]', [IMG_OK])
  await waitFor(`!/Đang tải…/.test(document.body.innerText)`)
  await sleep(500)
  await ev(`document.getElementById('f-name').form.requestSubmit()`)
  await waitFor(`location.pathname === '/kenh-nguoi-ban'`)
  product = await myProduct(shop.id)
  rec(
    'G2-09',
    sellerSeesReason &&
      resubmitLabel &&
      product.status === 'pending' &&
      product.images.length === 2,
    `người bán thấy lý do=${sellerSeesReason}; nút "Lưu và gửi duyệt lại"=${resubmitLabel}; DB status=${product.status}, ${product.images.length} ảnh`,
  )

  // ===== G2-10 – admin duyệt → hiện trên web có ảnh, trang shop =====
  await viewport(1366, 900, false)
  await loginAs(admin, '/admin/duyet?tab=san-pham')
  await waitFor(`!!${itemJs(PRODUCT_NAME)}`)
  await clickText('Duyệt', itemJs(PRODUCT_NAME))
  await waitFor(`/Đã duyệt “/.test(document.body.innerText)`)
  product = await myProduct(shop.id)
  await logout()
  await open(`/san-pham/${product.id}`)
  t = await text()
  const imgLoaded = await waitFor(
    `[...document.images].some((i) => i.src.includes('/product-images/${shop.id}/') && i.complete && i.naturalWidth > 0)`,
    8000,
  )
  const descLiteral = t.includes('<b>6 nhân 12 luồng</b>')
  await open(`/shop/${shop.slug}`)
  const onShopPage = await has(`/${PRODUCT_NAME}/`)
  rec(
    'G2-10',
    product.status === 'active' &&
      t.includes(PRODUCT_NAME) &&
      t.includes(SHOP_NAME) &&
      /3\.490\.000/.test(t) &&
      imgLoaded &&
      descLiteral &&
      onShopPage,
    `DB status=${product.status}; trang sản phẩm: tên=${t.includes(PRODUCT_NAME)}, shop=${t.includes(SHOP_NAME)}, giá 3.490.000=${/3\.490\.000/.test(t)}, ảnh tải được=${imgLoaded}, mô tả HTML hiện nguyên văn=${descLiteral}; trang shop có sản phẩm=${onShopPage}`,
  )

  // ===== G2-11 – chọn được trong Build PC =====
  await open('/build-pc')
  await waitFor(
    `[...document.querySelectorAll('main button')].some((b) => b.innerText.trim() === 'Chọn')`,
  )
  await clickText('Chọn', 'document.querySelector("main tbody tr")')
  await waitFor(`!!document.querySelector('dialog[open] input')`)
  await ev(fillJs(`document.querySelector('dialog[open] input')`, PRODUCT_NAME))
  await waitFor(
    `document.querySelector('dialog[open]').innerText.includes(${JSON.stringify(PRODUCT_NAME)})`,
    8000,
  )
  const inPicker = await ev(
    `document.querySelector('dialog[open]')?.innerText.includes(${JSON.stringify(PRODUCT_NAME)})`,
  )
  // Mỗi linh kiện trong ô chọn là 1 nút (PartOption)
  await ev(
    `[...document.querySelectorAll('dialog[open] li > button')].find((b) => b.innerText.includes(${JSON.stringify(PRODUCT_NAME)}))?.click()`,
  )
  await sleep(600)
  const picked = await ev(
    `document.querySelector("main tbody tr")?.innerText.includes(${JSON.stringify(PRODUCT_NAME)})`,
  )
  rec(
    'G2-11',
    inPicker && picked,
    `tìm thấy trong ô chọn CPU=${inPicker}; chọn vào cấu hình=${picked}`,
  )
  await shot('G2-11-build-pc-1366')

  // ===== G2-12 – không tràn ngang 360 px; ảnh chế độ tối =====
  await viewport(360, 800, true)
  await open(`/san-pham/${product.id}`)
  overflow['san-pham'] = await noHorizontalScroll()
  await open(`/shop/${shop.slug}`)
  overflow['shop'] = await noHorizontalScroll()
  await loginAs(admin, '/admin/duyet')
  overflow['admin-duyet'] = await noHorizontalScroll()
  const bad = Object.entries(overflow).filter(([, ok]) => !ok)
  rec(
    'G2-12',
    bad.length === 0,
    `360 px không tràn ngang: ${Object.keys(overflow).length - bad.length}/${Object.keys(overflow).length}${bad.length ? ` (tràn: ${bad.map(([k]) => k).join(', ')})` : ''}`,
  )
  await viewport(1366, 900, false)
  await ev(`localStorage.setItem('hcmusware.theme', 'dark')`)
  await open('/admin/duyet?tab=tat-ca-shop')
  await shot('G2-12-admin-shop-toi-1366')
  await loginAs(owner, `/kenh-nguoi-ban/san-pham/${product.id}`)
  await shot('G2-12-sua-san-pham-toi-1366')

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
