// Kiểm thử end-to-end Giai đoạn 2 – Tuần 5 (#113): trigger thông báo chạy thật, rồi xem trên chuông.
// Mọi thao tác gọi REST/RPC bằng token của đúng người làm (như bấm trên web), không chèn thông báo tay:
//   G5-01  admin duyệt shop → người bán có "Shop đã được duyệt"
//   G5-02  admin duyệt sản phẩm → người bán có "Sản phẩm đã được duyệt"
//   G5-03  khách đặt đơn → người bán có "Shop có đơn mới #<mã>"
//   G5-04  khách hỏi về sản phẩm → người bán có "Câu hỏi mới về sản phẩm"
//   G5-05  người bán chuyển đơn Đã xác nhận → Đang giao → Hoàn tất → khách có đủ 3 thông báo, link /don-hang/<mã>
//   G5-06  người bán hủy đơn khác → khách có "Đã hủy"
//   G5-07  khách gọi thẳng API đổi trạng thái đơn của mình → DB không đổi (RLS), không có thông báo
//   G5-08  khách tắt email trạng thái đơn → thông báo không xếp hàng gửi email (email_status rỗng)
//   G5-09  khách 360 px: chuông đúng số chưa đọc, bấm "Hoàn tất" → mở /don-hang/<mã>, DB đánh dấu đã đọc
//   G5-10  người bán 1280 px: chuông đúng số, bấm "Câu hỏi mới" → /kenh-nguoi-ban/cau-hoi
// Email test tắt từ đầu: địa chỉ @hcmusware.test không có thật, gửi thật thì Brevo trả về lỗi (bounce).
// Tự tạo tài khoản g2t5-*@hcmusware.test, shop và sản phẩm thử; cuối cùng hủy đơn và xóa sạch.
//
// Cách chạy:
//   Local : npm run build && npm run preview, rồi npm run test:e2e:g2t5
//   Vercel: npm run db:backup, rồi npm run test:e2e:g2t5:online (DB online → https://hcmusware.vercel.app)
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const SB = process.env.VITE_SUPABASE_URL
const ANON = process.env.VITE_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SB || !ANON || !SERVICE)
  throw new Error(
    'Thiếu VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY: chạy với --env-file',
  )
const IS_LOCAL = /127\.0\.0\.1|localhost/.test(SB)
const BASE = (
  process.env.BASE_URL || (IS_LOCAL ? 'http://localhost:4173' : 'https://hcmusware.vercel.app')
).replace(/\/$/, '')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// token = null: khóa anon; SERVICE: bỏ qua RLS (chuẩn bị, kiểm tra, dọn); còn lại: token của người dùng
async function api(token, path, { method = 'GET', body } = {}) {
  const res = await fetch(SB + path, {
    method,
    headers: {
      apikey: token === SERVICE ? SERVICE : ANON,
      Authorization: `Bearer ${token ?? ANON}`,
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
const sb = (path, opts) => api(SERVICE, path, opts)
// Dòng đầu tiên của kết quả POST; lỗi thì dừng kèm chi tiết để biết vì sao
const first = (what, r) => {
  if (r.status >= 300 || !r.data?.[0])
    throw new Error(`${what} lỗi ${r.status}: ${JSON.stringify(r.data)}`)
  return r.data[0]
}
const rpc = (token, fn, args = {}) =>
  api(token, `/rest/v1/rpc/${fn}`, { method: 'POST', body: args })

const ts = Date.now()
const PASS = 'G2t5-Qa-' + ts
async function createUser(tag, role, fullName) {
  const email = `g2t5-${tag}-${ts}@hcmusware.test`
  const r = await sb('/auth/v1/admin/users', {
    method: 'POST',
    body: { email, password: PASS, email_confirm: true, user_metadata: { full_name: fullName } },
  })
  if (!r.data.id) throw new Error('Tạo user lỗi: ' + JSON.stringify(r.data))
  await sb(`/rest/v1/profiles?id=eq.${r.data.id}`, {
    method: 'PATCH',
    body: { role, email_order_status: false, email_price_alerts: false },
  })
  const login = await api(null, '/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: { email, password: PASS },
  })
  if (!login.data.access_token) throw new Error('Đăng nhập lỗi: ' + JSON.stringify(login.data))
  return { email, id: r.data.id, token: login.data.access_token }
}

// Hủy đơn còn mở (trả kho) → xóa đơn → sản phẩm → shop → tài khoản (thông báo, câu hỏi xóa theo)
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
    const ids = (await sb(`/rest/v1/products?select=id&shop_id=eq.${s.id}`)).data.map((p) => p.id)
    if (ids.length) await sb(`/rest/v1/comments?product_id=in.(${ids})`, { method: 'DELETE' })
    await sb(`/rest/v1/products?shop_id=eq.${s.id}`, { method: 'DELETE' })
    await sb(`/rest/v1/shops?id=eq.${s.id}`, { method: 'DELETE' })
  }
  return (await sb(`/auth/v1/admin/users/${u.id}`, { method: 'DELETE' })).status
}
const old = (await sb('/auth/v1/admin/users?per_page=1000')).data.users ?? []
for (const u of old.filter((u) => /^g2t5-[a-z]+-\d+@hcmusware\.test$/.test(u.email)))
  console.log('Xóa dữ liệu test cũ', u.email, await cleanupUser(u))

const results = []
const rec = (code, ok, detail) => {
  results.push({ code, ok })
  console.log(`${ok ? 'ĐẠT ' : 'LỖI '} ${code.padEnd(7)} ${detail}`)
}
// Thông báo của một người, mới nhất trước (đọc bằng service role để so với giao diện)
const notifs = async (u) =>
  (
    await sb(
      `/rest/v1/notifications?select=id,type,title,link,read_at,email_status&user_id=eq.${u.id}&order=id.desc`,
    )
  ).data

const buyer = await createUser('khach', 'customer', 'Khách G2T5')
const seller = await createUser('ban', 'customer', 'Chủ Shop G2T5')
const admin = await createUser('admin', 'admin', 'Admin G2T5')
const users = [buyer, seller, admin]
console.log('Tài khoản test:', users.map((u) => u.email).join(', '))

let browser
let ws
try {
  // ---------- G5-01 duyệt shop ----------
  const shop = first(
    'Đăng ký shop',
    await api(seller.token, '/rest/v1/shops?select=id,name,slug,status', {
      method: 'POST',
      body: { name: `Shop G2T5 ${ts}`, slug: `g2t5-${ts}`, description: 'Shop thử thông báo' },
    }),
  )
  const approveShop = await rpc(admin.token, 'approve_shop', { p_shop_id: shop.id })
  {
    const n = await notifs(seller)
    rec(
      'G5-01',
      approveShop.status < 300 &&
        n.some((x) => x.type === 'shop_review' && /được duyệt/.test(x.title)),
      `đăng ký: ${shop.status}; duyệt: ${approveShop.status}; thông báo: ${n.map((x) => x.title).join(' | ')}`,
    )
  }

  // ---------- G5-02 duyệt sản phẩm ----------
  const cpuCat = (await sb('/rest/v1/categories?select=id&slug=eq.cpu')).data[0].id
  const product = first(
    'Đăng sản phẩm',
    await api(seller.token, '/rest/v1/products?select=id,name,status', {
      method: 'POST',
      body: {
        shop_id: shop.id,
        category_id: cpuCat,
        name: `CPU thử G2T5 ${ts}`,
        brand: 'AMD',
        price: 2000000,
        stock: 9,
        specs: { socket: 'AM5', tdp_w: 65, igpu: true },
      },
    }),
  )
  const approveProduct = await rpc(admin.token, 'approve_product', { p_product_id: product.id })
  {
    const n = await notifs(seller)
    rec(
      'G5-02',
      product.status === 'pending' &&
        approveProduct.status < 300 &&
        n.some((x) => x.type === 'product_review' && /được duyệt/.test(x.title)),
      `đăng: ${product.status}; duyệt: ${approveProduct.status}; mới nhất: "${n[0]?.title}" → ${n[0]?.link}`,
    )
  }

  // ---------- G5-03 đơn mới ----------
  const placeOrder = async () => {
    const r = await rpc(buyer.token, 'place_order', {
      p_items: [{ product_id: product.id, quantity: 1 }],
      p_shipping_name: 'Khách G2T5',
      p_shipping_phone: '0901234567',
      p_shipping_address: '227 Nguyễn Văn Cừ, Phường Chợ Quán, TP Hồ Chí Minh',
      p_payment_method: 'cod',
    })
    if (r.status >= 300) throw new Error('Đặt đơn lỗi: ' + JSON.stringify(r.data))
    return r.data
  }
  const order1 = await placeOrder()
  await sleep(500)
  {
    const n = await notifs(seller)
    const hit = n.find((x) => x.type === 'order_new' && x.title.includes(`#${order1}`))
    rec('G5-03', !!hit && hit.link === '/kenh-nguoi-ban/don-hang', `"${hit?.title}" → ${hit?.link}`)
  }

  // ---------- G5-04 câu hỏi mới ----------
  const ask = await api(buyer.token, '/rest/v1/comments', {
    method: 'POST',
    body: {
      product_id: product.id,
      parent_id: null,
      body: 'CPU này có kèm quạt không shop?',
      is_seller: false,
    },
  })
  {
    const n = await notifs(seller)
    const hit = n.find((x) => x.type === 'question_new')
    rec(
      'G5-04',
      ask.status < 300 && !!hit && hit.link === '/kenh-nguoi-ban/cau-hoi',
      `hỏi: ${ask.status}; "${hit?.title}" → ${hit?.link}`,
    )
  }

  // ---------- G5-05 khách nhận thông báo đổi trạng thái ----------
  const setStatus = (token, id, status) =>
    api(token, `/rest/v1/orders?id=eq.${id}`, { method: 'PATCH', body: { status } })
  const steps = []
  for (const st of ['confirmed', 'shipping', 'completed'])
    steps.push(`${st} ${(await setStatus(seller.token, order1, st)).status}`)
  {
    const n = (await notifs(buyer)).filter((x) => x.link === `/don-hang/${order1}`)
    const titles = n.map((x) => x.title).reverse()
    const want = ['Đã xác nhận', 'Đang giao', 'Hoàn tất'].map((s) => `Đơn hàng #${order1}: ${s}`)
    rec(
      'G5-05',
      titles.join() === want.join(),
      `${steps.join(', ')}; khách có: ${titles.join(' | ')}`,
    )
  }

  // ---------- G5-06 người bán hủy ----------
  const order2 = await placeOrder()
  const cancel2 = await setStatus(seller.token, order2, 'cancelled')
  {
    const n = await notifs(buyer)
    rec(
      'G5-06',
      cancel2.status < 300 && n.some((x) => x.title === `Đơn hàng #${order2}: Đã hủy`),
      `hủy: ${cancel2.status}; "${n[0]?.title}" → ${n[0]?.link}`,
    )
  }

  // ---------- G5-07 khách không tự đổi được trạng thái đơn (chỉ admin, chủ shop) ----------
  const order3 = await placeOrder()
  const cancel3 = await setStatus(buyer.token, order3, 'cancelled')
  const db3 = (await sb(`/rest/v1/orders?select=status&id=eq.${order3}`)).data[0]?.status
  {
    const n = await notifs(buyer)
    rec(
      'G5-07',
      db3 === 'pending' && !n.some((x) => x.link === `/don-hang/${order3}`),
      `khách PATCH: ${cancel3.status}, DB vẫn ${db3}; thông báo về đơn #${order3}: ${n.filter((x) => x.link === `/don-hang/${order3}`).length}`,
    )
  }

  // ---------- G5-08 đã tắt email → không xếp hàng email ----------
  {
    const n = (await notifs(buyer)).filter((x) => x.type === 'order_status')
    rec(
      'G5-08',
      n.length > 0 && n.every((x) => x.email_status == null),
      `email_status của ${n.length} thông báo đơn: ${[...new Set(n.map((x) => String(x.email_status)))].join(', ')}`,
    )
  }

  // ---------- Trình duyệt ----------
  const browserPath = [
    process.env.BROWSER,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
  ]
    .filter(Boolean)
    .find((p) => existsSync(p))
  browser = spawn(browserPath, [
    '--headless=new',
    '--remote-debugging-port=9345',
    `--user-data-dir=${mkdtempSync(join(tmpdir(), 'e2e-g2t5-'))}`,
    '--no-first-run',
    '--disable-extensions',
    'about:blank',
  ])
  let targets
  for (let i = 0; i < 50 && !targets; i++) {
    try {
      targets = await (await fetch('http://127.0.0.1:9345/json')).json()
    } catch {
      await sleep(200)
    }
  }
  ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl)
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
  const waitFor = async (expr, ms = 15000) => {
    for (let t = 0; t < ms; t += 250) {
      if (await ev(expr)) return true
      await sleep(250)
    }
    return false
  }
  await send('Runtime.enable')
  await send('Page.enable')
  const notBusy = `document.readyState === 'complete' && !document.querySelector('.animate-pulse') && !/Đang tải|Đang kiểm tra/.test(document.body.innerText)`
  const open = async (p) => {
    await send('Page.navigate', { url: BASE + p })
    await sleep(500)
    await waitFor(notBusy)
    await sleep(400)
  }
  const fillJs = (sel, val) => `(() => {
    const el = ${sel}; if (!el) return false
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(val)})
    el.dispatchEvent(new Event('input', { bubbles: true }))
    return true })()`
  const loginAs = async (u) => {
    await open('/')
    await ev('localStorage.clear()')
    await open('/dang-nhap?next=%2F')
    await waitFor(`!!document.querySelector('input[type=email]')`)
    await ev(fillJs(`document.querySelector('input[type=email]')`, u.email))
    await ev(fillJs(`document.querySelector('input[type=password]')`, PASS))
    await ev(`document.querySelector('input[type=email]').form.requestSubmit()`)
    await waitFor(`location.pathname === '/'`)
    await waitFor(notBusy)
    await waitFor(`!!document.querySelector('button[title="Thông báo"]')`)
    await sleep(800)
  }
  const vp = (width, mobile) =>
    send('Emulation.setDeviceMetricsOverride', { width, height: 800, deviceScaleFactor: 1, mobile })
  const bell = `document.querySelector('button[title="Thông báo"]')`
  const panel = `document.querySelector('[aria-label="Danh sách thông báo"]')`
  const unread = async (u) => (await notifs(u)).filter((x) => !x.read_at)
  // Mở chuông, bấm thông báo có tiêu đề khớp; trả [số trên chuông, trang mở ra, dòng đó trong DB]
  const clickNotif = async (u, titlePart, link) => {
    const badge = await ev(`${bell}?.innerText.trim()`)
    await ev(`${bell}.click()`)
    await waitFor(`!!${panel} && !/Đang tải/.test(${panel}.innerText)`)
    await ev(
      `[...${panel}.querySelectorAll('li a')].find((a) => a.innerText.includes(${JSON.stringify(titlePart)}))?.click()`,
    )
    await waitFor(`location.pathname === ${JSON.stringify(link)}`, 8000)
    await sleep(1200)
    const row = (await notifs(u)).find((x) => x.title.includes(titlePart))
    return [badge, await ev('location.pathname'), row]
  }

  // ---------- G5-09 khách 360 px ----------
  await vp(360, true)
  await loginAs(buyer)
  {
    const want = (await unread(buyer)).length
    const title = `Đơn hàng #${order1}: Hoàn tất`
    const [badge, path, row] = await clickNotif(buyer, title, `/don-hang/${order1}`)
    rec(
      'G5-09',
      badge === String(want) &&
        path === `/don-hang/${order1}` &&
        !!row?.read_at &&
        !(await ev(`!!${panel}`)),
      `chuông "${badge}" (DB chưa đọc ${want}); bấm "${title}" → ${path}; DB đã đọc=${!!row?.read_at}`,
    )
  }

  // ---------- G5-10 người bán 1280 px ----------
  await vp(1280, false)
  await loginAs(seller)
  {
    const want = (await unread(seller)).length
    const [badge, path, row] = await clickNotif(seller, 'Câu hỏi mới', '/kenh-nguoi-ban/cau-hoi')
    const asked = await waitFor(`document.body.innerText.includes('có kèm quạt không')`, 8000)
    rec(
      'G5-10',
      badge === String(want) && path === '/kenh-nguoi-ban/cau-hoi' && !!row?.read_at && asked,
      `chuông "${badge}" (DB chưa đọc ${want}); bấm "Câu hỏi mới" → ${path}; thấy câu hỏi=${asked}; DB đã đọc=${!!row?.read_at}`,
    )
  }
  rec(
    'Console',
    consoleErrors.length === 0,
    consoleErrors.slice(0, 5).join(' | ') || 'không có lỗi đỏ',
  )
} finally {
  ws?.close()
  browser?.kill()
  console.log(`\nDọn dẹp: ${(await Promise.all(users.map(cleanupUser))).join(', ')}`)
  const ok = results.filter((r) => r.ok).length
  console.log(`${ok}/${results.length} đạt`)
  process.exitCode = ok === results.length && results.length ? 0 : 1
}
