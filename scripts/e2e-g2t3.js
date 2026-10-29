// Kiểm thử end-to-end Giai đoạn 2 – Tuần 3 bằng Edge/Chrome headless:
//   G3-01..03  giỏ có hàng của 2 shop → 2 đơn cùng mã thanh toán; khách thấy 2 đơn nhóm theo lần đặt
//   G3-04..05  người bán chỉ thấy và cập nhật đơn của shop mình (kênh người bán → Đơn hàng)
//   G3-06..07  sổ địa chỉ: địa chỉ nhập lúc thanh toán đã vào sổ; ô gợi ý dùng bằng bàn phím,
//              gõ không dấu vẫn ra, gõ tên không có trong danh sách thì báo lỗi
//   G3-08      gợi ý Tỉnh/Thành, Phường/Xã: gõ có dấu, không dấu, có dấu nháy (Cư M'gar) đều ra đúng
//   G3-09      C6: người bán bỏ bước (Chờ xác nhận → Hoàn tất) được; Đang giao → Đã xác nhận bị chặn
//              ở cả giao diện lẫn API
// Tự tạo khách, người bán, shop và sản phẩm thử (@hcmusware.test); cuối cùng hủy đơn (trả kho) và xóa sạch.
//
// Cách chạy:
//   Local : npm run build && npm run preview, rồi npm run test:e2e:g2t3
//   Vercel: npm run test:e2e:g2t3:online (DB online → https://hcmusware.vercel.app)
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
const PASS = 'G2t3-Qa-' + ts
async function createUser(tag, role = 'customer') {
  const email = `g2t3-${tag}-${ts}@hcmusware.test`
  const r = await sb('/auth/v1/admin/users', {
    method: 'POST',
    body: { email, password: PASS, email_confirm: true, user_metadata: { full_name: 'G2T3 QA' } },
  })
  if (!r.data.id) throw new Error('Tạo user lỗi: ' + JSON.stringify(r.data))
  if (role !== 'customer')
    await sb(`/rest/v1/profiles?id=eq.${r.data.id}`, { method: 'PATCH', body: { role } })
  return { email, id: r.data.id }
}

// Xóa dữ liệu test của lần chạy hỏng trước: hủy đơn (trả kho) → xóa đơn → sản phẩm → shop → tài khoản.
async function cleanupUser(u) {
  const shops = (await sb(`/rest/v1/shops?select=id&owner_id=eq.${u.id}`)).data
  const filters = [`user_id=eq.${u.id}`, ...shops.map((s) => `shop_id=eq.${s.id}`)]
  for (const f of filters) {
    for (const o of (await sb(`/rest/v1/orders?select=id&${f}&status=not.in.(completed,cancelled)`))
      .data)
      await sb(`/rest/v1/orders?id=eq.${o.id}`, { method: 'PATCH', body: { status: 'cancelled' } })
    await sb(`/rest/v1/orders?${f}`, { method: 'DELETE' })
  }
  for (const s of shops) {
    await sb(`/rest/v1/products?shop_id=eq.${s.id}`, { method: 'DELETE' })
    await sb(`/rest/v1/shops?id=eq.${s.id}`, { method: 'DELETE' })
  }
  return (await sb(`/auth/v1/admin/users/${u.id}`, { method: 'DELETE' })).status
}
const old = (await sb('/auth/v1/admin/users?per_page=1000')).data.users ?? []
for (const u of old.filter((u) => /^g2t3-[a-z]+-\d+@hcmusware\.test$/.test(u.email)))
  console.log('Xóa dữ liệu test cũ', u.email, await cleanupUser(u))

const customer = await createUser('khach')
const seller = await createUser('ban', 'seller')
console.log('Tài khoản test:', customer.email, '/', seller.email)

const cpuCat = (await sb('/rest/v1/categories?select=id&slug=eq.cpu')).data[0].id
const shop = (
  await sb('/rest/v1/shops', {
    method: 'POST',
    body: { owner_id: seller.id, name: `Shop G2T3 ${ts}`, slug: `g2t3-${ts}`, status: 'active' },
  })
).data[0]
const sellerProduct = (
  await sb('/rest/v1/products?select=id,name,brand,price,stock,image_url,categories(slug)', {
    method: 'POST',
    body: {
      category_id: cpuCat,
      name: `CPU thử G2T3 ${ts}`,
      brand: 'AMD',
      price: 2000000,
      stock: 5,
      specs: { socket: 'AM5', tdp_w: 65, igpu: true },
      shop_id: shop.id,
      status: 'active',
    },
  })
).data[0]
const houseShop = (await sb('/rest/v1/shops?select=id,name,slug&slug=eq.hcmusware')).data[0]
const houseProduct = (
  await sb(
    `/rest/v1/products?select=id,name,brand,price,stock,image_url,categories(slug)&shop_id=eq.${houseShop.id}&status=eq.active&stock=gte.5&order=id&limit=1`,
  )
).data[0]
const stockOf = async (id) => (await sb(`/rest/v1/products?id=eq.${id}&select=stock`)).data[0].stock
const stock0 = { house: houseProduct.stock, seller: sellerProduct.stock }

const cartLine = (p, s, qty) => ({
  id: p.id,
  name: p.name,
  brand: p.brand,
  price: p.price,
  image_url: p.image_url,
  slug: p.categories?.slug,
  stock: p.stock,
  shop_name: s.name,
  shop_slug: s.slug,
  qty,
})

// ---------- Trình duyệt (cùng cách với scripts/e2e-tuan5.js) ----------
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
  '--remote-debugging-port=9335',
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'e2e-g2t3-'))}`,
  '--no-first-run',
  '--disable-extensions',
  'about:blank',
])
let targets
for (let i = 0; i < 50 && !targets; i++) {
  try {
    targets = await (await fetch('http://127.0.0.1:9335/json')).json()
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
await send('Page.enable')

const text = () => ev('document.body.innerText')
const path = () => ev('location.pathname + location.search')
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
const fieldByLabel = (label) =>
  `[...document.querySelectorAll('label')].find((l) => l.innerText.trim().startsWith(${JSON.stringify(label)}))?.querySelector('input,textarea,select')`
const byId = (id) => `document.getElementById(${JSON.stringify(id)})`
const key = (id, k) =>
  ev(
    `${byId(id)}.dispatchEvent(new KeyboardEvent('keydown', { key: '${k}', bubbles: true, cancelable: true }))`,
  )
async function pickSuggestion(inputId, query) {
  await waitFor(`!${byId(inputId)}?.disabled`)
  await ev(fillJs(byId(inputId), query))
  await waitFor(`!!document.querySelector('#${inputId}-goi-y [role=option]:not([aria-disabled])')`)
  await key(inputId, 'Enter')
  await sleep(200)
  return ev(`${byId(inputId)}.value`)
}

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

try {
  await send('Emulation.setDeviceMetricsOverride', {
    width: 360,
    height: 800,
    deviceScaleFactor: 1,
    mobile: true,
  })

  // ===== G3-01 – thanh toán giỏ 2 shop: báo tách đơn, nhập địa chỉ bằng gợi ý =====
  await open('/')
  await ev(
    `localStorage.setItem('hcmusware.cart', ${JSON.stringify(
      JSON.stringify([cartLine(houseProduct, houseShop, 1), cartLine(sellerProduct, shop, 2)]),
    )})`,
  )
  await open('/dang-nhap?next=%2Fthanh-toan')
  await login(customer.email)
  await waitFor(
    `location.pathname === '/thanh-toan' && !!document.getElementById('thanh-toan-tinh')`,
  )
  let t = await text()
  const splitNotice = /Giỏ có hàng của 2 shop/.test(t)
  await ev(fillJs(fieldByLabel('Họ tên người nhận'), 'G2T3 QA'))
  await ev(fillJs(fieldByLabel('Số điện thoại'), '0901234567'))
  const province = await pickSuggestion('thanh-toan-tinh', 'ho chi minh')
  const ward = await pickSuggestion('thanh-toan-xa', 'ben thanh')
  await ev(fillJs(fieldByLabel('Số nhà và đường'), '227 Nguyễn Văn Cừ'))
  const saveChecked = await ev(
    `[...document.querySelectorAll('label')].find((l) => /Lưu vào sổ địa chỉ/.test(l.innerText))?.querySelector('input').checked`,
  )
  await shot('G3-01-thanh-toan-2-shop-360')
  await ev(`document.querySelector('input[name=payment]').form.requestSubmit()`)
  await waitFor(`/^\\/don-hang\\/\\d+/.test(location.pathname)`)
  await waitFor(`/Cùng lần đặt hàng/.test(document.body.innerText)`)
  t = await text()
  const firstId = Number((await path()).match(/(\d+)/)?.[1])
  const code = (await sb(`/rest/v1/orders?select=payment_code&id=eq.${firstId}`)).data[0]
    ?.payment_code
  const group = (
    await sb(
      `/rest/v1/orders?select=id,shop_id,total,shipping_address&payment_code=eq.${code}&order=id`,
    )
  ).data
  const houseOrder = group.find((o) => o.shop_id === houseShop.id)
  const sellerOrder = group.find((o) => o.shop_id === shop.id)
  rec(
    'G3-01',
    splitNotice &&
      province === 'Thành phố Hồ Chí Minh' &&
      ward === 'Phường Bến Thành' &&
      saveChecked === true &&
      group.length === 2 &&
      houseOrder?.total === houseProduct.price &&
      sellerOrder?.total === sellerProduct.price * 2 &&
      sellerOrder?.shipping_address ===
        '227 Nguyễn Văn Cừ, Phường Bến Thành, Thành phố Hồ Chí Minh',
    `báo tách đơn=${splitNotice}, gợi ý "${province}" / "${ward}", lưu vào sổ chọn sẵn=${saveChecked}; mã ${code}: ${group.length} đơn, địa chỉ lưu="${sellerOrder?.shipping_address}"`,
  )
  rec(
    'G3-02',
    /tách thành 2 đơn/.test(t) &&
      t.includes(code) &&
      (await stockOf(houseProduct.id)) === stock0.house - 1 &&
      (await stockOf(sellerProduct.id)) === stock0.seller - 2,
    `trang đơn: báo tách 2 đơn=${/tách thành 2 đơn/.test(t)}, hiện mã thanh toán=${t.includes(code)}; kho HcmusWare ${stock0.house}→${await stockOf(houseProduct.id)}, kho shop thử ${stock0.seller}→${await stockOf(sellerProduct.id)}`,
  )
  await shot('G3-02-don-hang-moi-360')

  // ===== G3-03 – lịch sử đơn nhóm theo lần đặt =====
  await open('/tai-khoan')
  t = await text()
  rec(
    'G3-03',
    t.includes(`Mã thanh toán ${code} · 2 đơn từ 2 shop`) &&
      t.includes(houseShop.name) &&
      t.includes(shop.name),
    `tài khoản: khung "${code} · 2 đơn từ 2 shop"=${t.includes(`Mã thanh toán ${code} · 2 đơn từ 2 shop`)}, tên 2 shop=${t.includes(houseShop.name)}/${t.includes(shop.name)}`,
  )

  // ===== G3-06 – địa chỉ đã vào sổ, là mặc định =====
  await open('/tai-khoan/dia-chi')
  t = await text()
  rec(
    'G3-06',
    /1\/10 địa chỉ/.test(t) &&
      /Mặc định/.test(t) &&
      t.includes('227 Nguyễn Văn Cừ, Phường Bến Thành'),
    `sổ địa chỉ sau khi đặt: 1/10=${/1\/10 địa chỉ/.test(t)}, mặc định=${/Mặc định/.test(t)}`,
  )

  // ===== G3-07 – ô gợi ý bằng bàn phím, gõ sai tên =====
  await ev(
    `[...document.querySelectorAll('button')].find((b) => /Thêm địa chỉ/.test(b.innerText)).click()`,
  )
  await waitFor(`!${byId('dia-chi-moi-tinh')}?.disabled`)
  await ev(fillJs(byId('dia-chi-moi-tinh'), 'KHANH HOA'))
  await waitFor(`!!document.querySelector('#dia-chi-moi-tinh-goi-y [role=option]')`)
  await key('dia-chi-moi-tinh', 'Enter')
  await sleep(200)
  const kh = await ev(`${byId('dia-chi-moi-tinh')}.value`)
  const wardEnabled = await ev(`!${byId('dia-chi-moi-xa')}.disabled`)
  await ev(fillJs(byId('dia-chi-moi-xa'), 'khong co xa nay'))
  await key('dia-chi-moi-xa', 'Escape')
  await ev(`${byId('dia-chi-moi-xa')}.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))`)
  await sleep(300)
  t = await text()
  rec(
    'G3-07',
    kh === 'Tỉnh Khánh Hoà' && wardEnabled && /Chọn Phường\/Xã trong danh sách gợi ý/.test(t),
    `gõ "KHANH HOA" + Enter → "${kh}", ô Phường/Xã mở=${wardEnabled}, gõ tên lạ → báo lỗi=${/Chọn Phường\/Xã trong danh sách gợi ý/.test(t)}`,
  )
  await shot('G3-07-so-dia-chi-360')

  // ===== G3-08 – gõ có dấu / không dấu / thiếu dấu nháy đều ra đúng gợi ý đầu tiên =====
  const ADDRESS_CASES = [
    ['ho chi', 'thu duc', 'Thành phố Hồ Chí Minh', 'Phường Thủ Đức'],
    ['dak lak', 'cu mgar', 'Tỉnh Đắk Lắk', "Xã Cư M'gar"],
    ['Hà Nội', 'Hoàn Kiếm', 'Thành phố Hà Nội', 'Phường Hoàn Kiếm'],
    ['HA NOI', 'hoan kiem', 'Thành phố Hà Nội', 'Phường Hoàn Kiếm'],
  ]
  const addressResults = []
  for (const [tinh, xa, wantTinh, wantXa] of ADDRESS_CASES) {
    await open('/tai-khoan/dia-chi')
    await ev(
      `[...document.querySelectorAll('button')].find((b) => /Thêm địa chỉ/.test(b.innerText)).click()`,
    )
    const gotTinh = await pickSuggestion('dia-chi-moi-tinh', tinh)
    const gotXa = await pickSuggestion('dia-chi-moi-xa', xa)
    addressResults.push({
      ok: gotTinh === wantTinh && gotXa === wantXa,
      text: `"${tinh}"/"${xa}" → ${gotTinh} / ${gotXa}`,
    })
  }
  rec(
    'G3-08',
    addressResults.every((r) => r.ok),
    addressResults.map((r) => (r.ok ? '' : 'SAI ') + r.text).join('; '),
  )

  // ===== G3-04/05 – người bán chỉ thấy, xử lý đơn của shop mình =====
  await ev('localStorage.clear()')
  await open('/dang-nhap?next=%2Fkenh-nguoi-ban%2Fdon-hang')
  await login(seller.email)
  await waitFor(`location.pathname === '/kenh-nguoi-ban/don-hang'`)
  await waitFor(`!!document.querySelector('select')`)
  t = await text()
  const sees = (id) => new RegExp(`#${id}\\b`).test(t)
  rec(
    'G3-04',
    sees(sellerOrder.id) && !sees(houseOrder.id),
    `kênh người bán: thấy đơn shop mình #${sellerOrder.id}=${sees(sellerOrder.id)}, thấy đơn HcmusWare #${houseOrder.id}=${sees(houseOrder.id)}`,
  )
  await ev(fillJs(`document.querySelector('select')`, 'confirmed'))
  await waitFor(
    `document.querySelector('select')?.value === 'confirmed' && !document.querySelector('select').disabled`,
  )
  await sleep(500)
  const after = (
    await sb(`/rest/v1/orders?select=id,status&id=in.(${sellerOrder.id},${houseOrder.id})`)
  ).data
  const statusOf = (id) => after.find((o) => o.id === id)?.status
  const options = await ev(`[...document.querySelector('select').options].map((o) => o.text)`)
  rec(
    'G3-05',
    statusOf(sellerOrder.id) === 'confirmed' &&
      statusOf(houseOrder.id) === 'pending' &&
      !options.includes('Chờ xác nhận'),
    `người bán xác nhận: đơn shop mình=${statusOf(sellerOrder.id)}, đơn HcmusWare vẫn=${statusOf(houseOrder.id)}; lựa chọn còn lại=${JSON.stringify(options)}`,
  )
  await shot('G3-05-kenh-nguoi-ban-don-360')

  // ===== G3-09 – C6: Chờ xác nhận → Hoàn tất được; Đang giao → Đã xác nhận bị chặn =====
  // Đơn thứ 2 của shop thử, tạo thẳng trong DB ở trạng thái Chờ xác nhận
  const pendingOrder = (
    await sb('/rest/v1/orders', {
      method: 'POST',
      body: {
        user_id: customer.id,
        shop_id: shop.id,
        status: 'pending',
        total: sellerProduct.price,
        shipping_name: 'G2T3 QA',
        shipping_phone: '0901234567',
        shipping_address: '227 Nguyễn Văn Cừ, Phường Chợ Quán, TP.HCM',
      },
    })
  ).data[0]
  await sb('/rest/v1/order_items', {
    method: 'POST',
    body: {
      order_id: pendingOrder.id,
      product_id: sellerProduct.id,
      quantity: 1,
      unit_price: sellerProduct.price,
    },
  })
  await open('/kenh-nguoi-ban/don-hang')
  await waitFor(`!!document.querySelector('select')`)
  // Ô trạng thái của đơn #id: leo lên tới khối có "#id" và chỉ chứa 1 ô chọn
  const selectOf = (id) => `(() => {
    for (const s of document.querySelectorAll('select')) {
      let el = s.parentElement
      while (el && el.querySelectorAll('select').length === 1) {
        if (new RegExp('#${id}\\\\b').test(el.innerText)) return s
        el = el.parentElement
      }
    }
  })()`
  const setStatus = async (id, status) => {
    await ev(fillJs(selectOf(id), status))
    await waitFor(`${selectOf(id)}?.value === '${status}' && !${selectOf(id)}.disabled`)
    await sleep(500)
  }
  const statusInDb = async (id) =>
    (await sb(`/rest/v1/orders?select=status&id=eq.${id}`)).data[0]?.status
  const optionsOf = (id) =>
    ev(`[...(${selectOf(id)}?.options ?? [])].filter((o) => !o.disabled).map((o) => o.text)`)

  await setStatus(pendingOrder.id, 'completed')
  const skipped = await statusInDb(pendingOrder.id)
  await setStatus(sellerOrder.id, 'shipping')
  const shippingOptions = await optionsOf(sellerOrder.id)
  // Lách giao diện: gọi thẳng API bằng phiên đăng nhập của người bán trong trình duyệt
  const backViaApi = await ev(`(async () => {
    const key = Object.keys(localStorage).find((k) => k.endsWith('-auth-token'))
    const token = JSON.parse(localStorage.getItem(key)).access_token
    const res = await fetch(${JSON.stringify(SB)} + '/rest/v1/orders?id=eq.${sellerOrder.id}', {
      method: 'PATCH',
      headers: { apikey: ${JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY)}, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'confirmed' }),
    })
    const body = await res.json()
    return res.status + ' ' + (body.message ?? JSON.stringify(body))
  })()`)
  const afterBack = await statusInDb(sellerOrder.id)
  rec(
    'G3-09',
    skipped === 'completed' &&
      !shippingOptions.some((o) => /Chờ xác nhận|Đã xác nhận/.test(o)) &&
      !/^2/.test(backViaApi) &&
      afterBack === 'shipping',
    `Chờ xác nhận → Hoàn tất: DB=${skipped}; Đang giao: lựa chọn còn lại=${JSON.stringify(shippingOptions)}; lùi về Đã xác nhận qua API: ${backViaApi}, DB vẫn=${afterBack}`,
  )
  await shot('G3-09-c6-trang-thai-360')

  rec(
    'Console',
    consoleErrors.length === 0,
    consoleErrors.length ? `lỗi đỏ: ${consoleErrors.join(' | ')}` : 'không có lỗi đỏ',
  )
} finally {
  browser.kill()
  console.log(
    `\nDọn dẹp: khách ${await cleanupUser(customer)}, người bán ${await cleanupUser(seller)}`,
  )
  console.log(`Kho cuối: HcmusWare ${await stockOf(houseProduct.id)} (đầu ${stock0.house})`)
}
const passed = results.filter((r) => r.ok).length
console.log(`${passed}/${results.length} đạt`)
process.exit(passed === results.length ? 0 : 1)
