// Kiểm thử quyền (RLS + hàm trong DB) cho 3 vai trò: khách hàng, người bán, admin – Giai đoạn 2 Tuần 1.
// Gọi thẳng REST/RPC của Supabase như một người dùng cố ý bỏ qua giao diện. Mỗi ca in ĐẠT/LỖI.
// Tự tạo tài khoản test (@hcmusware.test), shop và sản phẩm thử; cuối cùng xóa sạch.
// Cần VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY trong file env.
//
// Cách chạy:
//   Local : npm run test:rls
//   Online: npm run db:backup trước, rồi npm run test:rls:online
// Chạy lại sau MỖI PR có migration (rủi ro "viết lại RLS làm lộ dữ liệu" trong kế hoạch giai đoạn 2).

const SB = process.env.VITE_SUPABASE_URL
const ANON = process.env.VITE_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SB || !ANON || !SERVICE)
  throw new Error(
    'Thiếu VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY: chạy với --env-file',
  )

const ts = Date.now()
const PASS = 'Rls-Test-' + ts

// Gọi REST với token của một người (null = khách chưa đăng nhập, SERVICE = bỏ qua RLS để chuẩn bị/dọn).
async function api(token, path, { method = 'GET', body, prefer = 'return=representation' } = {}) {
  const res = await fetch(SB + path, {
    method,
    headers: {
      apikey: token === SERVICE ? SERVICE : ANON,
      Authorization: `Bearer ${token ?? ANON}`,
      'Content-Type': 'application/json',
      Prefer: prefer,
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
  return { status: res.status, ok: res.ok, data }
}
const svc = (path, opts) => api(SERVICE, path, opts)
const rpc = (token, fn, args = {}) =>
  api(token, `/rest/v1/rpc/${fn}`, { method: 'POST', body: args })
const errMsg = (r) => (typeof r.data === 'object' ? (r.data?.message ?? '') : String(r.data))

async function createUser(tag, role) {
  const email = `rls-${tag}-${ts}@hcmusware.test`
  const r = await svc('/auth/v1/admin/users', {
    method: 'POST',
    body: {
      email,
      password: PASS,
      email_confirm: true,
      user_metadata: { full_name: `RLS ${tag}` },
    },
  })
  if (!r.data.id) throw new Error('Tạo user lỗi: ' + JSON.stringify(r.data))
  if (role !== 'customer')
    await svc(`/rest/v1/profiles?id=eq.${r.data.id}`, { method: 'PATCH', body: { role } })
  const login = await api(null, '/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: { email, password: PASS },
  })
  if (!login.data.access_token) throw new Error('Đăng nhập lỗi: ' + JSON.stringify(login.data))
  return { email, id: r.data.id, token: login.data.access_token }
}

const results = []
const rec = (code, ok, detail) => {
  results.push({ code, ok })
  console.log(`${ok ? 'ĐẠT ' : 'LỖI '} ${code.padEnd(6)} ${detail}`)
}

// ---------- Chuẩn bị ----------
// Dọn tài khoản test của lần chạy hỏng trước (xóa shop trước vì shops.owner_id chặn xóa user).
const oldUsers = (await svc('/auth/v1/admin/users?per_page=1000')).data.users ?? []
for (const u of oldUsers.filter((u) => /^rls-[a-z0-9]+-\d+@hcmusware\.test$/.test(u.email))) {
  // Đơn của lần chạy hỏng chặn xóa sản phẩm, shop, tài khoản (khóa ngoại) → xóa trước.
  await svc(`/rest/v1/orders?user_id=eq.${u.id}`, { method: 'DELETE' })
  const shops = (await svc(`/rest/v1/shops?select=id&owner_id=eq.${u.id}`)).data
  for (const s of shops) {
    await svc(`/rest/v1/orders?shop_id=eq.${s.id}`, { method: 'DELETE' })
    await svc(`/rest/v1/products?shop_id=eq.${s.id}`, { method: 'DELETE' })
    await svc(`/rest/v1/shops?id=eq.${s.id}`, { method: 'DELETE' })
  }
  await svc(`/auth/v1/admin/users/${u.id}`, { method: 'DELETE' })
}

const customer = await createUser('khach', 'customer')
const seller = await createUser('ban', 'seller')
const seller2 = await createUser('ban2', 'seller')
const seller3 = await createUser('ban3', 'seller')
const admin = await createUser('admin', 'admin')
const testUsers = [customer, seller, seller2, seller3, admin]
console.log('Tài khoản test:', testUsers.map((u) => u.email).join(', '))

const mkShop = async (owner, slug, status) =>
  (
    await svc('/rest/v1/shops', {
      method: 'POST',
      body: { owner_id: owner.id, name: `Shop ${slug}`, slug: `${slug}-${ts}`, status },
    })
  ).data[0]
const shopA = await mkShop(seller, 'rls-a', 'active')
const shopB = await mkShop(seller2, 'rls-b', 'active')
const houseShop = (await svc('/rest/v1/shops?select=id&slug=eq.hcmusware')).data[0]
const cpuCat = (await svc('/rest/v1/categories?select=id&slug=eq.cpu')).data[0].id

const mkProduct = async (shop, tag, status) =>
  (
    await svc('/rest/v1/products', {
      method: 'POST',
      body: {
        category_id: cpuCat,
        name: `RLS ${tag} ${ts}`,
        brand: 'AMD',
        price: 1000000,
        stock: 5,
        specs: { socket: 'AM5', tdp_w: 65, igpu: true },
        shop_id: shop.id,
        status,
      },
    })
  ).data[0]
const pActiveA = await mkProduct(shopA, 'A-dang-ban', 'active')
const pPendingA = await mkProduct(shopA, 'A-cho-duyet', 'pending')
const pActiveB = await mkProduct(shopB, 'B-dang-ban', 'active')
const pHouse = (await svc(`/rest/v1/products?select=id&shop_id=eq.${houseShop.id}&limit=1`)).data[0]

const seeProduct = async (token, id) =>
  (await api(token, `/rest/v1/products?select=id,status&id=eq.${id}`)).data.length === 1

// ---------- Khách chưa đăng nhập ----------
{
  const all = (await api(null, '/rest/v1/products?select=id,status,shop_id')).data
  const bad = all.filter((p) => p.status !== 'active')
  rec(
    'RLS01',
    all.length > 0 && bad.length === 0 && !(await seeProduct(null, pPendingA.id)),
    `chưa đăng nhập đọc ${all.length} sản phẩm, sản phẩm không "đang bán" lọt ra: ${bad.length}`,
  )
  const ins = await api(null, '/rest/v1/products', {
    method: 'POST',
    body: { category_id: cpuCat, name: `RLS anon ${ts}`, price: 1, shop_id: shopA.id },
  })
  const brand = await api(null, '/rest/v1/brands', {
    method: 'POST',
    body: { name: `RLS anon ${ts}`, slug: `rls-anon-${ts}` },
  })
  rec(
    'RLS02',
    !ins.ok && !brand.ok,
    `chưa đăng nhập thêm sản phẩm: ${ins.status}, thêm thương hiệu: ${brand.status}`,
  )
  const list = await rpc(null, 'admin_list_users')
  const role = await rpc(null, 'set_user_role', { p_user_id: customer.id, p_role: 'admin' })
  rec(
    'RLS03',
    !list.ok && !role.ok,
    `chưa đăng nhập gọi admin_list_users: ${list.status}, set_user_role: ${role.status}`,
  )
}

// ---------- Khách hàng ----------
{
  const self = await api(customer.token, `/rest/v1/profiles?id=eq.${customer.id}`, {
    method: 'PATCH',
    body: { role: 'admin' },
  })
  const role = await rpc(customer.token, 'set_user_role', {
    p_user_id: customer.id,
    p_role: 'admin',
  })
  const now = (await svc(`/rest/v1/profiles?select=role&id=eq.${customer.id}`)).data[0].role
  rec(
    'RLS04',
    !self.ok && !role.ok && now === 'customer',
    `khách tự nâng quyền: PATCH ${self.status}, set_user_role ${role.status} "${errMsg(role)}", vai trò hiện tại=${now}`,
  )
  const list = await rpc(customer.token, 'admin_list_users')
  const profiles = (await api(customer.token, '/rest/v1/profiles?select=id')).data
  rec(
    'RLS05',
    !list.ok && profiles.length === 1,
    `khách gọi admin_list_users: ${list.status}; đọc bảng profiles thấy ${profiles.length} dòng (chỉ của mình)`,
  )
  const ins = await api(customer.token, '/rest/v1/products', {
    method: 'POST',
    body: { category_id: cpuCat, name: `RLS khach ${ts}`, price: 1, shop_id: shopA.id },
  })
  const upd = await api(customer.token, `/rest/v1/products?id=eq.${pActiveA.id}`, {
    method: 'PATCH',
    body: { price: 1 },
  })
  rec(
    'RLS06',
    !ins.ok && upd.ok && upd.data.length === 0,
    `khách thêm sản phẩm vào shop người khác: ${ins.status}; sửa giá sản phẩm: ${upd.data.length} dòng bị đổi`,
  )
  // Đăng ký mở shop: gửi status "active" vẫn bị ép về "pending"
  const reg = await api(customer.token, '/rest/v1/shops', {
    method: 'POST',
    body: { owner_id: customer.id, name: 'Shop khách', slug: `rls-khach-${ts}`, status: 'active' },
  })
  const myShop = reg.data?.[0]
  rec(
    'RLS07',
    reg.ok && myShop?.status === 'pending',
    `khách đăng ký mở shop gửi status=active: ${reg.status}, trạng thái lưu=${myShop?.status}`,
  )
  const approve = await api(customer.token, `/rest/v1/shops?id=eq.${myShop?.id}`, {
    method: 'PATCH',
    body: { status: 'active' },
  })
  const second = await api(customer.token, '/rest/v1/shops', {
    method: 'POST',
    body: { owner_id: customer.id, name: 'Shop thứ 2', slug: `rls-khach2-${ts}` },
  })
  rec(
    'RLS08',
    !approve.ok && !second.ok,
    `khách tự duyệt shop: ${approve.status} "${errMsg(approve)}"; mở shop thứ 2: ${second.status}`,
  )
  const otherPending = (await api(seller.token, `/rest/v1/shops?select=id&id=eq.${myShop?.id}`))
    .data.length
  const anonPending = (await api(null, `/rest/v1/shops?select=id&id=eq.${myShop?.id}`)).data.length
  rec(
    'RLS09',
    otherPending === 0 && anonPending === 0,
    `shop chờ duyệt của khách: người bán khác thấy ${otherPending}, chưa đăng nhập thấy ${anonPending}`,
  )
  // Shop chờ duyệt chưa được đăng sản phẩm (dù có vai trò seller cũng không – xem RLS15)
  const sell = await api(customer.token, '/rest/v1/products', {
    method: 'POST',
    body: { category_id: cpuCat, name: `RLS khach shop ${ts}`, price: 1, shop_id: myShop?.id },
  })
  rec('RLS10', !sell.ok, `khách đăng sản phẩm vào shop chờ duyệt của mình: ${sell.status}`)
}

// ---------- Người bán ----------
let sellerNew
{
  const ins = await api(seller.token, '/rest/v1/products', {
    method: 'POST',
    body: {
      category_id: cpuCat,
      name: `RLS ban moi ${ts}`,
      brand: 'AMD',
      price: 2000000,
      stock: 3,
      specs: { socket: 'AM5' },
      shop_id: shopA.id,
      status: 'active',
      approved_at: new Date().toISOString(),
    },
  })
  sellerNew = ins.data?.[0]
  rec(
    'RLS11',
    ins.ok && sellerNew?.status === 'pending' && sellerNew?.approved_at === null,
    `người bán đăng sản phẩm gửi status=active: ${ins.status}, lưu status=${sellerNew?.status}, approved_at=${sellerNew?.approved_at}`,
  )
  const own = await seeProduct(seller.token, sellerNew?.id)
  const byCustomer = await seeProduct(customer.token, sellerNew?.id)
  const byOtherSeller = await seeProduct(seller2.token, sellerNew?.id)
  rec(
    'RLS12',
    own && !byCustomer && !byOtherSeller,
    `sản phẩm chờ duyệt: chủ shop thấy=${own}, khách thấy=${byCustomer}, người bán khác thấy=${byOtherSeller}`,
  )
  const intoB = await api(seller.token, '/rest/v1/products', {
    method: 'POST',
    body: { category_id: cpuCat, name: `RLS ban B ${ts}`, price: 1, shop_id: shopB.id },
  })
  const intoHouse = await api(seller.token, '/rest/v1/products', {
    method: 'POST',
    body: { category_id: cpuCat, name: `RLS ban house ${ts}`, price: 1 },
  })
  rec(
    'RLS13',
    !intoB.ok && !intoHouse.ok,
    `người bán thêm sản phẩm vào shop khác: ${intoB.status}, vào shop HcmusWare (mặc định): ${intoHouse.status}`,
  )
  const updB = await api(seller.token, `/rest/v1/products?id=eq.${pActiveB.id}`, {
    method: 'PATCH',
    body: { price: 1, status: 'hidden' },
  })
  const updHouse = await api(seller.token, `/rest/v1/products?id=eq.${pHouse.id}`, {
    method: 'PATCH',
    body: { price: 1 },
  })
  const delOwn = await api(seller.token, `/rest/v1/products?id=eq.${pActiveA.id}`, {
    method: 'DELETE',
  })
  const stillOwn = (await svc(`/rest/v1/products?select=id&id=eq.${pActiveA.id}`)).data.length
  rec(
    'RLS14',
    updB.data.length === 0 &&
      updHouse.data.length === 0 &&
      delOwn.data.length === 0 &&
      stillOwn === 1,
    `người bán sửa sản phẩm shop khác: ${updB.data.length} dòng, shop HcmusWare: ${updHouse.data.length} dòng; tự xóa sản phẩm của mình: còn ${stillOwn}`,
  )
  const selfApprove = await api(seller.token, `/rest/v1/products?id=eq.${pPendingA.id}`, {
    method: 'PATCH',
    body: { status: 'active' },
  })
  const move = await api(seller.token, `/rest/v1/products?id=eq.${pActiveA.id}`, {
    method: 'PATCH',
    body: { shop_id: shopB.id },
  })
  rec(
    'RLS15',
    !selfApprove.ok && !move.ok,
    `người bán tự duyệt sản phẩm: ${selfApprove.status} "${errMsg(selfApprove)}"; chuyển sản phẩm sang shop khác: ${move.status}`,
  )
  // Ẩn rồi bán lại sản phẩm đã duyệt: được phép, khách thấy/không thấy theo trạng thái
  const hide = await api(seller.token, `/rest/v1/products?id=eq.${pActiveA.id}`, {
    method: 'PATCH',
    body: { status: 'hidden' },
  })
  const hiddenToCustomer = await seeProduct(customer.token, pActiveA.id)
  const show = await api(seller.token, `/rest/v1/products?id=eq.${pActiveA.id}`, {
    method: 'PATCH',
    body: { status: 'active' },
  })
  const shownToCustomer = await seeProduct(customer.token, pActiveA.id)
  rec(
    'RLS16',
    hide.data?.length === 1 && !hiddenToCustomer && show.data?.length === 1 && shownToCustomer,
    `ẩn sản phẩm đã duyệt: ${hide.status}, khách thấy=${hiddenToCustomer}; bán lại: ${show.status}, khách thấy=${shownToCustomer}`,
  )
  // Đổi giá: trigger lịch sử giá phải chạy được bằng quyền người bán
  const price = await api(seller.token, `/rest/v1/products?id=eq.${pActiveA.id}`, {
    method: 'PATCH',
    body: { price: 1234000 },
  })
  const hist = (
    await svc(`/rest/v1/price_history?select=price&product_id=eq.${pActiveA.id}&price=eq.1234000`)
  ).data.length
  const directHist = await api(seller.token, '/rest/v1/price_history', {
    method: 'POST',
    body: { product_id: pActiveB.id, price: 1 },
  })
  rec(
    'RLS17',
    price.ok && hist === 1 && !directHist.ok,
    `người bán đổi giá: ${price.status}, ghi lịch sử giá=${hist}; tự ghi lịch sử giá sản phẩm khác: ${directHist.status}`,
  )
  const brand = await api(seller.token, '/rest/v1/brands', {
    method: 'POST',
    body: { name: `RLS ban ${ts}`, slug: `rls-ban-${ts}` },
  })
  const editShop = await api(seller.token, `/rest/v1/shops?id=eq.${shopA.id}`, {
    method: 'PATCH',
    body: { description: 'Mô tả mới' },
  })
  const lockOther = await api(seller.token, `/rest/v1/shops?id=eq.${shopB.id}`, {
    method: 'PATCH',
    body: { status: 'locked' },
  })
  rec(
    'RLS18',
    !brand.ok && editShop.data?.length === 1 && lockOther.data?.length === 0,
    `người bán tạo thương hiệu: ${brand.status}; sửa mô tả shop mình: ${editShop.data?.length} dòng; khóa shop khác: ${lockOther.data?.length} dòng`,
  )
  const list = await rpc(seller.token, 'admin_list_users')
  const profiles = (await api(seller.token, '/rest/v1/profiles?select=id')).data
  const orders = (await api(seller.token, '/rest/v1/orders?select=id')).data
  rec(
    'RLS19',
    !list.ok && profiles.length === 1 && orders.length === 0,
    `người bán gọi admin_list_users: ${list.status}; thấy ${profiles.length} hồ sơ, ${orders.length} đơn của người khác`,
  )
}

// ---------- Admin ----------
{
  const list = await rpc(admin.token, 'admin_list_users', { p_search: `-${ts}@hcmusware.test` })
  const emails = (list.data ?? []).map((u) => u.email)
  const sellerRow = (list.data ?? []).find((u) => u.id === seller.id)
  rec(
    'RLS20',
    list.ok && emails.includes(customer.email) && sellerRow?.shop_name === shopA.name,
    `admin_list_users tìm theo email: ${list.status}, ${emails.length} tài khoản test, shop của người bán="${sellerRow?.shop_name}"`,
  )
  const up = await rpc(admin.token, 'set_user_role', { p_user_id: customer.id, p_role: 'seller' })
  const r1 = (await svc(`/rest/v1/profiles?select=role&id=eq.${customer.id}`)).data[0].role
  const down = await rpc(admin.token, 'set_user_role', {
    p_user_id: customer.id,
    p_role: 'customer',
  })
  const self = await rpc(admin.token, 'set_user_role', { p_user_id: admin.id, p_role: 'customer' })
  const bad = await rpc(admin.token, 'set_user_role', { p_user_id: customer.id, p_role: 'root' })
  rec(
    'RLS21',
    up.ok && r1 === 'seller' && down.ok && !self.ok && !bad.ok,
    `admin đổi vai trò khách→người bán: ${up.status} (${r1}), trả lại: ${down.status}; tự hạ quyền: ${self.status} "${errMsg(self)}"; vai trò "root": ${bad.status}`,
  )
  const approve = await api(admin.token, `/rest/v1/products?id=eq.${sellerNew.id}`, {
    method: 'PATCH',
    body: { status: 'active' },
  })
  const visible = await seeProduct(null, sellerNew.id)
  rec(
    'RLS22',
    approve.data?.[0]?.status === 'active' && approve.data?.[0]?.approved_at && visible,
    `admin duyệt sản phẩm người bán: approved_at=${approve.data?.[0]?.approved_at ? 'có' : 'trống'}, chưa đăng nhập thấy=${visible}`,
  )
  // Khóa shop A: khách không thấy hàng của shop, người bán mất quyền ghi.
  // Tuần 2: khóa qua hàm set_shop_locked (C4), không PATCH thẳng status.
  const lock = await rpc(admin.token, 'set_shop_locked', { p_shop_id: shopA.id, p_locked: true })
  const anonSee = await seeProduct(null, pActiveA.id)
  const sellerSee = await seeProduct(seller.token, pActiveA.id)
  const sellerEdit = await api(seller.token, `/rest/v1/products?id=eq.${pActiveA.id}`, {
    method: 'PATCH',
    body: { price: 999000 },
  })
  rec(
    'RLS23',
    lock.ok && !anonSee && sellerSee && sellerEdit.data?.length === 0,
    `admin khóa shop: ${lock.status}; khách thấy hàng của shop=${anonSee}, chủ shop vẫn thấy=${sellerSee}, chủ shop sửa được ${sellerEdit.data?.length} dòng`,
  )
  // Mua sản phẩm không được bán: gọi thẳng place_order
  const order = (product) =>
    rpc(customer.token, 'place_order', {
      p_items: [{ product_id: product.id, quantity: 1 }],
      p_shipping_name: 'RLS Test',
      p_shipping_phone: '0901234567',
      p_shipping_address: '227 Nguyễn Văn Cừ, Quận 5, TP.HCM',
      p_payment_method: 'cod',
    })
  const buyPending = await order(pPendingA)
  const buyLocked = await order(pActiveA)
  rec(
    'RLS24',
    !buyPending.ok && !buyLocked.ok,
    `khách đặt sản phẩm chờ duyệt: ${buyPending.status} "${errMsg(buyPending)}"; sản phẩm của shop bị khóa: ${buyLocked.status}`,
  )
  const buyOk = await order(pActiveB)
  const orderId = buyOk.data
  const sellerSeesOrder = (await api(seller2.token, `/rest/v1/orders?select=id&id=eq.${orderId}`))
    .data.length
  rec(
    'RLS25',
    buyOk.ok && Number.isInteger(orderId) && sellerSeesOrder === 1,
    `khách đặt sản phẩm đang bán của shop B: ${buyOk.status} (đơn #${orderId}); người bán B thấy đơn của shop mình: ${sellerSeesOrder}`,
  )
  if (orderId) {
    await svc(`/rest/v1/orders?id=eq.${orderId}`, {
      method: 'PATCH',
      body: { status: 'cancelled' },
    })
    await svc(`/rest/v1/order_items?order_id=eq.${orderId}`, { method: 'DELETE' })
    await svc(`/rest/v1/orders?id=eq.${orderId}`, { method: 'DELETE' })
  }
}

// ---------- Admin gỡ sản phẩm, shop HcmusWare (sửa sau review) ----------
{
  // Shop B vẫn hoạt động; sản phẩm đang bán pActiveB đã được duyệt.
  const takeDown = await api(admin.token, `/rest/v1/products?id=eq.${pActiveB.id}`, {
    method: 'PATCH',
    body: { status: 'hidden' },
  })
  const relist = await api(seller2.token, `/rest/v1/products?id=eq.${pActiveB.id}`, {
    method: 'PATCH',
    body: { status: 'active' },
  })
  const now = (await svc(`/rest/v1/products?select=status&id=eq.${pActiveB.id}`)).data[0].status
  rec(
    'RLS26',
    takeDown.data?.[0]?.approved_at === null && !relist.ok && now === 'hidden',
    `admin gỡ sản phẩm: approved_at=${takeDown.data?.[0]?.approved_at}; người bán tự bán lại: ${relist.status} "${errMsg(relist)}", trạng thái=${now}`,
  )
  const rename = await api(admin.token, `/rest/v1/shops?id=eq.${houseShop.id}`, {
    method: 'PATCH',
    body: { slug: `hcmusware-moi-${ts}` },
  })
  const slug = (await svc(`/rest/v1/shops?select=slug&id=eq.${houseShop.id}`)).data[0].slug
  rec(
    'RLS27',
    !rename.ok && slug === 'hcmusware',
    `admin đổi đường dẫn shop HcmusWare: ${rename.status} "${errMsg(rename)}", slug hiện tại=${slug}`,
  )
}

// ---------- Tuần 2: duyệt shop, duyệt sản phẩm, ảnh (migration 20261130000000) ----------
{
  const shopOf = async (owner) =>
    (await svc(`/rest/v1/shops?select=id,status,review_note&owner_id=eq.${owner.id}`)).data[0]
  const roleOf = async (u) =>
    (await svc(`/rest/v1/profiles?select=role&id=eq.${u.id}`)).data[0].role
  // Shop chờ duyệt của khách (tạo ở RLS07)
  const custShop = await shopOf(customer)

  const selfApprove = await rpc(customer.token, 'approve_shop', { p_shop_id: custShop.id })
  const sellerApprove = await rpc(seller.token, 'approve_shop', { p_shop_id: custShop.id })
  const custList = await rpc(customer.token, 'admin_list_shops')
  rec(
    'T2-01',
    !selfApprove.ok && !sellerApprove.ok && !custList.ok,
    `khách / người bán gọi approve_shop: ${selfApprove.status} / ${sellerApprove.status}; khách gọi admin_list_shops: ${custList.status}`,
  )

  const noNote = await rpc(admin.token, 'reject_shop', { p_shop_id: custShop.id, p_note: '  ' })
  const reject = await rpc(admin.token, 'reject_shop', {
    p_shop_id: custShop.id,
    p_note: 'Tên shop chưa rõ ràng',
  })
  const seen = (
    await api(customer.token, `/rest/v1/shops?select=status,review_note&id=eq.${custShop.id}`)
  ).data[0]
  rec(
    'T2-02',
    !noNote.ok && reject.ok && seen?.status === 'rejected' && seen?.review_note,
    `admin từ chối không lý do: ${noNote.status}; có lý do: ${reject.status}, khách thấy "${seen?.status}" + lý do "${seen?.review_note}"`,
  )

  const toActive = await api(customer.token, `/rest/v1/shops?id=eq.${custShop.id}`, {
    method: 'PATCH',
    body: { status: 'active' },
  })
  const resubmit = await api(customer.token, `/rest/v1/shops?id=eq.${custShop.id}`, {
    method: 'PATCH',
    body: { status: 'pending', name: 'Shop khách sửa lại', review_note: 'tự ghi' },
  })
  const after = await shopOf(customer)
  rec(
    'T2-03',
    !toActive.ok && resubmit.ok && after.status === 'pending' && after.review_note === null,
    `khách tự chuyển rejected→active: ${toActive.status}; gửi lại (→pending): ${resubmit.status}, trạng thái=${after.status}, lý do=${after.review_note}`,
  )

  const direct = await api(admin.token, `/rest/v1/shops?id=eq.${custShop.id}`, {
    method: 'PATCH',
    body: { status: 'active' },
  })
  const approve = await rpc(admin.token, 'approve_shop', { p_shop_id: custShop.id })
  const approved = await shopOf(customer)
  const custRole = await roleOf(customer)
  rec(
    'T2-04',
    !direct.ok && approve.ok && approved.status === 'active' && custRole === 'seller',
    `admin PATCH thẳng status: ${direct.status} "${errMsg(direct)}"; approve_shop: ${approve.status}, shop=${approved.status}, vai trò chủ shop=${custRole}`,
  )

  const lockHouse = await rpc(admin.token, 'set_shop_locked', {
    p_shop_id: houseShop.id,
    p_locked: true,
  })
  const unlockA = await rpc(admin.token, 'set_shop_locked', {
    p_shop_id: shopA.id,
    p_locked: false,
  })
  const anonSeeA = await seeProduct(null, pActiveA.id)
  const list = await rpc(admin.token, 'admin_list_shops', { p_status: 'active' })
  const row = list.data?.find?.((s) => s.id === custShop.id)
  rec(
    'T2-05',
    !lockHouse.ok && unlockA.ok && anonSeeA && row?.owner_email === customer.email,
    `khóa shop HcmusWare: ${lockHouse.status} "${errMsg(lockHouse)}"; mở khóa shop A: ${unlockA.status}, khách thấy lại hàng=${anonSeeA}; admin_list_shops có email chủ shop=${row?.owner_email === customer.email}`,
  )

  // C3: người bán đổi giá → vẫn bán; đổi thông số → chờ duyệt lại
  const price = await api(seller.token, `/rest/v1/products?id=eq.${pActiveA.id}`, {
    method: 'PATCH',
    body: { price: 1200000, review_note: 'tự ghi' },
  })
  const specs = await api(seller.token, `/rest/v1/products?id=eq.${pActiveA.id}`, {
    method: 'PATCH',
    body: { specs: { socket: 'AM5', tdp_w: 105, igpu: true } },
  })
  rec(
    'T2-06',
    price.data?.[0]?.status === 'active' &&
      price.data?.[0]?.review_note === null &&
      specs.data?.[0]?.status === 'pending' &&
      specs.data?.[0]?.approved_at === null,
    `người bán đổi giá: trạng thái=${price.data?.[0]?.status}, tự ghi lý do=${price.data?.[0]?.review_note}; đổi thông số: trạng thái=${specs.data?.[0]?.status}, approved_at=${specs.data?.[0]?.approved_at}`,
  )

  // C1: sản phẩm "Thương hiệu khác" (brand_id trống) không duyệt được
  const odd = (
    await api(seller.token, '/rest/v1/products', {
      method: 'POST',
      body: {
        category_id: cpuCat,
        name: `RLS hang la ${ts}`,
        brand: `Hang La ${ts}`,
        price: 1000000,
        stock: 1,
        specs: { socket: 'AM5' },
        shop_id: shopA.id,
      },
    })
  ).data[0]
  const noBrand = await rpc(admin.token, 'approve_product', { p_product_id: odd.id })
  const sellerApproveP = await rpc(seller.token, 'approve_product', { p_product_id: pActiveA.id })
  const okApprove = await rpc(admin.token, 'approve_product', { p_product_id: pActiveA.id })
  rec(
    'T2-07',
    odd.brand_id === null && !noBrand.ok && !sellerApproveP.ok && okApprove.ok,
    `sản phẩm thương hiệu lạ: brand_id=${odd.brand_id}, admin duyệt: ${noBrand.status} "${errMsg(noBrand)}"; người bán gọi approve_product: ${sellerApproveP.status}; duyệt sản phẩm có thương hiệu: ${okApprove.status}`,
  )

  // C2: trả lại kèm lý do → ẩn; người bán gửi lại → chờ duyệt, lý do bị xóa
  const back = await rpc(admin.token, 'reject_product', {
    p_product_id: odd.id,
    p_note: 'Chưa có thương hiệu',
  })
  const hidden = (await svc(`/rest/v1/products?select=status,review_note&id=eq.${odd.id}`)).data[0]
  const again = await api(seller.token, `/rest/v1/products?id=eq.${odd.id}`, {
    method: 'PATCH',
    body: { status: 'pending' },
  })
  rec(
    'T2-08',
    back.ok &&
      hidden.status === 'hidden' &&
      hidden.review_note &&
      again.data?.[0]?.status === 'pending' &&
      again.data?.[0]?.review_note === null,
    `admin trả lại: ${back.status}, trạng thái=${hidden.status}, lý do="${hidden.review_note}"; người bán gửi lại: ${again.data?.[0]?.status}, lý do=${again.data?.[0]?.review_note}`,
  )

  // Ảnh: chỉ ghi vào thư mục shop của mình, ≤ 2 MB, chỉ ảnh
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  )
  const upload = (token, path, body = png, type = 'image/png') =>
    fetch(`${SB}/storage/v1/object/product-images/${path}`, {
      method: 'POST',
      headers: { apikey: ANON, Authorization: `Bearer ${token ?? ANON}`, 'Content-Type': type },
      body,
    }).then((r) => r.status)
  const own = await upload(seller.token, `${shopA.id}/rls-${ts}.png`)
  const other = await upload(seller.token, `${shopB.id}/rls-${ts}.png`)
  const anon = await upload(null, `${shopA.id}/rls-anon-${ts}.png`)
  const big = await upload(seller.token, `${shopA.id}/rls-big-${ts}.png`, Buffer.alloc(2_200_000))
  const html = await upload(
    seller.token,
    `${shopA.id}/rls-${ts}.html`,
    '<script>alert(1)</script>',
    'text/html',
  )
  rec(
    'T2-09',
    own === 200 && other >= 400 && anon >= 400 && big >= 400 && html >= 400,
    `tải ảnh vào thư mục shop mình: ${own}; shop khác: ${other}; chưa đăng nhập: ${anon}; ảnh 2,2 MB: ${big}; file HTML: ${html}`,
  )
  await svc('/storage/v1/object/product-images', {
    method: 'DELETE',
    body: { prefixes: [`${shopA.id}/rls-${ts}.png`] },
  })

  // Hai shop được bán cùng tên sản phẩm (unique theo shop + danh mục)
  const houseName = (await svc(`/rest/v1/products?select=name,category_id&id=eq.${pHouse.id}`))
    .data[0]
  const dup = await api(seller.token, '/rest/v1/products', {
    method: 'POST',
    body: { ...houseName, brand: 'AMD', price: 1000000, stock: 1, shop_id: shopA.id },
  })
  const dup2 = await api(seller.token, '/rest/v1/products', {
    method: 'POST',
    body: { ...houseName, brand: 'AMD', price: 1000000, stock: 1, shop_id: shopA.id },
  })
  rec(
    'T2-10',
    dup.ok && !dup2.ok,
    `người bán đăng sản phẩm trùng tên shop HcmusWare: ${dup.status}; trùng tên trong shop mình: ${dup2.status}`,
  )

  // brand_list đếm như nhau cho mọi người: chỉ hàng đang bán của shop đang hoạt động
  const anonBrands = (await rpc(null, 'brand_list')).data
  const adminBrands = (await rpc(admin.token, 'brand_list')).data
  const total = (list) => list.reduce((n, b) => n + Number(b.product_count), 0)
  const onSale = (
    await api(null, '/rest/v1/products?select=id&brand_id=not.is.null', { prefer: 'count=exact' })
  ).data.length
  rec(
    'T2-11',
    total(anonBrands) === total(adminBrands) && total(anonBrands) === onSale,
    `brand_list: chưa đăng nhập đếm ${total(anonBrands)}, admin đếm ${total(adminBrands)}, sản phẩm đang bán có thương hiệu: ${onSale}`,
  )

  // US-15.6: admin quản lý thương hiệu. Đổi tên có dấu → products.brand đổi theo, không sinh
  // thương hiệu thừa (slugify trong DB không bỏ dấu); người bán không sửa/xóa được; còn sản phẩm thì không xóa được.
  const brand = (
    await api(admin.token, '/rest/v1/brands', {
      method: 'POST',
      body: { name: `RLS TH ${ts}`, slug: `rls-th-${ts}` },
    })
  ).data[0]
  const pBrand = (
    await svc('/rest/v1/products', {
      method: 'POST',
      body: {
        category_id: cpuCat,
        name: `RLS thuong hieu ${ts}`,
        brand_id: brand.id,
        price: 1000000,
        stock: 1,
        specs: { socket: 'AM5', tdp_w: 65, igpu: true },
        shop_id: shopA.id,
        status: 'active',
      },
    })
  ).data[0]
  const sellerEdit = await api(seller.token, `/rest/v1/brands?id=eq.${brand.id}`, {
    method: 'PATCH',
    body: { name: 'Bị đổi' },
  })
  const sellerDel = await api(seller.token, `/rest/v1/brands?id=eq.${brand.id}`, {
    method: 'DELETE',
  })
  const newName = `Ánh Dương ${ts}`
  const rename = await api(admin.token, `/rest/v1/brands?id=eq.${brand.id}`, {
    method: 'PATCH',
    body: { name: newName, slug: `rls-anh-duong-${ts}` },
  })
  const renamed = (await svc(`/rest/v1/products?select=brand,brand_id&id=eq.${pBrand.id}`)).data[0]
  const extra = (await svc(`/rest/v1/brands?select=id&name=eq.${encodeURIComponent(newName)}`)).data
    .length
  const delUsed = await api(admin.token, `/rest/v1/brands?id=eq.${brand.id}`, { method: 'DELETE' })
  rec(
    'T2-12',
    sellerEdit.data?.length === 0 &&
      sellerDel.data?.length === 0 &&
      rename.ok &&
      renamed.brand === newName &&
      renamed.brand_id === brand.id &&
      extra === 1 &&
      delUsed.status === 409,
    `người bán sửa/xóa thương hiệu: ${sellerEdit.data?.length}/${sellerDel.data?.length} dòng; admin đổi tên có dấu: ${rename.status}, sản phẩm brand="${renamed.brand}", brand_id giữ=${renamed.brand_id === brand.id}, số thương hiệu tên mới=${extra}; xóa khi còn sản phẩm: ${delUsed.status}`,
  )
}

// ---------- Tuần 3: đơn nhiều shop, sổ địa chỉ (migration 20261207000000) ----------
{
  const shopC = await mkShop(seller3, 'rls-c', 'active')
  const pB = await mkProduct(shopB, 'B-t3', 'active')
  const pC = await mkProduct(shopC, 'C-t3', 'active')
  const buy = (payment) =>
    rpc(customer.token, 'place_order', {
      p_items: [
        { product_id: pB.id, quantity: 1 },
        { product_id: pC.id, quantity: 2 },
      ],
      p_shipping_name: 'RLS Test',
      p_shipping_phone: '0901234567',
      p_shipping_address: '227 Nguyễn Văn Cừ, Phường Chợ Quán, TP.HCM',
      p_payment_method: payment,
    })
  const ORDER_COLS = 'id,shop_id,payment_code,total,status,paid_at'
  const group = async (token, firstId) => {
    const code = (await svc(`/rest/v1/orders?select=payment_code&id=eq.${firstId}`)).data[0]
      ?.payment_code
    return (
      await api(token, `/rest/v1/orders?select=${ORDER_COLS}&payment_code=eq.${code}&order=id`)
    ).data
  }

  const cod = await buy('cod')
  const mine = await group(customer.token, cod.data)
  const oB = mine.find((o) => o.shop_id === shopB.id)
  const oC = mine.find((o) => o.shop_id === shopC.id)
  rec(
    'T3-01',
    cod.ok &&
      mine.length === 2 &&
      /^TT\d+$/.test(mine[0].payment_code) &&
      mine[0].payment_code === mine[1].payment_code &&
      oB?.total === 1000000 &&
      oC?.total === 2000000,
    `giỏ 2 shop: ${cod.status}, tạo ${mine.length} đơn, mã thanh toán ${mine.map((o) => o.payment_code).join('/')}, tiền shop B=${oB?.total}, shop C=${oC?.total}`,
  )

  const seen = async (token) =>
    (await api(token, `/rest/v1/orders?select=id&id=in.(${oB.id},${oC.id})`)).data.map((o) => o.id)
  const itemsSeen = async (token) =>
    (await api(token, `/rest/v1/order_items?select=order_id&order_id=in.(${oB.id},${oC.id})`)).data
      .length
  const s2 = await seen(seller2.token)
  const s3 = await seen(seller3.token)
  const s1 = await seen(seller.token)
  const adminSeen = await seen(admin.token)
  rec(
    'T3-02',
    s2.length === 1 &&
      s2[0] === oB.id &&
      s3.length === 1 &&
      s3[0] === oC.id &&
      s1.length === 0 &&
      adminSeen.length === 2 &&
      (await itemsSeen(seller2.token)) === 1 &&
      (await itemsSeen(seller.token)) === 0,
    `người bán B thấy đơn [${s2}], người bán C thấy [${s3}], người bán A thấy [${s1}], admin thấy ${adminSeen.length}; dòng hàng người bán B / A đọc được: ${await itemsSeen(seller2.token)} / ${await itemsSeen(seller.token)}`,
  )

  const patch = (token, id, body) =>
    api(token, `/rest/v1/orders?id=eq.${id}`, { method: 'PATCH', body })
  const okB = await patch(seller2.token, oB.id, { status: 'confirmed' })
  const otherShop = await patch(seller2.token, oC.id, { status: 'confirmed' })
  const total = await patch(seller2.token, oB.id, { total: 1 })
  const back = await patch(seller2.token, oB.id, { status: 'pending' })
  const custPatch = await patch(customer.token, oC.id, { status: 'completed' })
  rec(
    'T3-03',
    okB.data?.[0]?.status === 'confirmed' &&
      otherShop.data?.length === 0 &&
      !total.ok &&
      !back.ok &&
      custPatch.data?.length === 0,
    `người bán B xác nhận đơn shop mình: ${okB.data?.[0]?.status}; sửa đơn shop C: ${otherShop.data?.length} dòng; sửa tổng tiền: ${total.status}; lùi về chờ xác nhận: ${back.status} "${errMsg(back)}"; khách tự đổi trạng thái: ${custPatch.data?.length} dòng`,
  )

  const online = await buy('mock_online')
  const pay = await rpc(customer.token, 'mock_pay_order', { p_order_id: online.data })
  const paid = await group(customer.token, online.data)
  const payAgain = await rpc(customer.token, 'mock_pay_order', { p_order_id: paid[1]?.id })
  const sellerPay = await rpc(seller2.token, 'mock_pay_order', { p_order_id: online.data })
  rec(
    'T3-04',
    online.ok &&
      pay.ok &&
      paid.length === 2 &&
      paid.every((o) => o.paid_at && o.status === 'confirmed') &&
      !payAgain.ok &&
      !sellerPay.ok,
    `thanh toán online 1 lần cho ${paid.length} đơn: ${pay.status}, đã trả ${paid.filter((o) => o.paid_at).length}; trả lại lần 2: ${payAgain.status} "${errMsg(payAgain)}"; người bán gọi thay khách: ${sellerPay.status}`,
  )

  const lockC = await rpc(admin.token, 'set_shop_locked', { p_shop_id: shopC.id, p_locked: true })
  const lockedSee = (await seen(seller3.token)).length
  const lockedEdit = await patch(seller3.token, oC.id, { status: 'cancelled' })
  rec(
    'T3-05',
    lockC.ok && lockedSee === 1 && lockedEdit.data?.length === 0,
    `shop C bị khóa: chủ shop vẫn xem ${lockedSee} đơn, đổi trạng thái được ${lockedEdit.data?.length} dòng`,
  )

  // Sổ địa chỉ
  const addr = (n, extra = {}) => ({
    recipient_name: `Người nhận ${n}`,
    phone: '0901234567',
    province_code: '79',
    province_name: 'Thành phố Hồ Chí Minh',
    ward_code: '26743',
    ward_name: 'Phường Bến Thành',
    street: `${n} Lê Lợi`,
    ...extra,
  })
  const addAddr = (token, body) => api(token, '/rest/v1/addresses', { method: 'POST', body })
  const a1 = (await addAddr(customer.token, addr(1, { is_default: false }))).data[0]
  const a2 = (await addAddr(customer.token, addr(2, { is_default: true }))).data[0]
  const a3 = (await addAddr(customer.token, addr(3))).data[0]
  const defaults = async () =>
    (
      await svc(`/rest/v1/addresses?select=id&user_id=eq.${customer.id}&is_default=is.true`)
    ).data.map((a) => a.id)
  const afterAdd = await defaults()
  rec(
    'T3-06',
    a1?.is_default === true &&
      a2?.is_default === true &&
      afterAdd.length === 1 &&
      afterAdd[0] === a2.id,
    `địa chỉ đầu tiên tự mặc định: ${a1?.is_default}; thêm địa chỉ mặc định mới → mặc định hiện tại [${afterAdd}] (mong đợi [${a2?.id}])`,
  )

  const unset = await api(customer.token, `/rest/v1/addresses?id=eq.${a2.id}`, {
    method: 'PATCH',
    body: { is_default: false },
  })
  await api(customer.token, `/rest/v1/addresses?id=eq.${a2.id}`, { method: 'DELETE' })
  const afterDel = await defaults()
  rec(
    'T3-07',
    !unset.ok && afterDel.length === 1 && afterDel[0] === a3.id,
    `bỏ mặc định trực tiếp: ${unset.status}; xóa địa chỉ mặc định → mặc định mới [${afterDel}] (mong đợi địa chỉ thêm gần nhất ${a3.id})`,
  )

  const otherRead = (
    await api(seller.token, `/rest/v1/addresses?select=id&user_id=eq.${customer.id}`)
  ).data.length
  const otherEdit = await api(seller.token, `/rest/v1/addresses?id=eq.${a1.id}`, {
    method: 'PATCH',
    body: { street: 'Bị sửa' },
  })
  const otherInsert = await addAddr(seller.token, addr(9, { user_id: customer.id }))
  const anonRead = (await api(null, '/rest/v1/addresses?select=id')).data.length
  const steal = await api(customer.token, `/rest/v1/addresses?id=eq.${a1.id}`, {
    method: 'PATCH',
    body: { user_id: seller.id },
  })
  rec(
    'T3-08',
    otherRead === 0 &&
      otherEdit.data?.length === 0 &&
      !otherInsert.ok &&
      anonRead === 0 &&
      !steal.ok,
    `người khác đọc ${otherRead}, sửa ${otherEdit.data?.length} địa chỉ của khách, thêm hộ: ${otherInsert.status}; chưa đăng nhập đọc ${anonRead}; khách chuyển địa chỉ sang tài khoản khác: ${steal.status}`,
  )

  for (let i = 4; i <= 11; i++) await addAddr(customer.token, addr(i))
  const count = (await svc(`/rest/v1/addresses?select=id&user_id=eq.${customer.id}`)).data.length
  const badPhone = await addAddr(seller.token, addr(1, { phone: '12345' }))
  rec(
    'T3-09',
    count === 10 && !badPhone.ok,
    `thêm tới địa chỉ thứ 11 → sổ còn ${count} (tối đa 10); số điện thoại sai: ${badPhone.status}`,
  )

  // Đơn chặn xóa sản phẩm / shop / tài khoản → xóa trước phần dọn dẹp chung.
  await svc(`/rest/v1/orders?user_id=eq.${customer.id}`, { method: 'DELETE' })
}

// ---------- Tuần 4: đánh giá, hỏi đáp (migration 20261214000000) ----------
{
  const p = await mkProduct(shopA, 'A-t4', 'active')
  // Đơn chèn thẳng bằng service role với trạng thái cho sẵn (không đi qua place_order).
  const mkOrder = async (user, status) => {
    const o = (
      await svc('/rest/v1/orders', {
        method: 'POST',
        body: {
          user_id: user.id,
          shop_id: shopA.id,
          status,
          shipping_name: 'RLS Test',
          shipping_phone: '0901234567',
          shipping_address: '227 Nguyễn Văn Cừ, Phường Chợ Quán, TP.HCM',
        },
      })
    ).data[0]
    await svc('/rest/v1/order_items', {
      method: 'POST',
      body: { order_id: o.id, product_id: p.id, quantity: 1, unit_price: 1000000 },
    })
    return o
  }
  const review = (token, body) =>
    api(token, '/rest/v1/reviews', { method: 'POST', body: { product_id: p.id, ...body } })
  const rating = async () =>
    (
      await api(
        null,
        `/rest/v1/product_ratings?select=rating_avg,rating_count&product_id=eq.${p.id}`,
      )
    ).data[0] ?? null

  // Người bán 2 có đơn nhưng chưa giao; khách chưa mua gì
  await mkOrder(seller2, 'shipping')
  const notBought = await review(customer.token, { rating: 5 })
  const notDelivered = await review(seller2.token, { rating: 5 })
  const anonReview = await review(null, { rating: 5 })
  const canBefore = (await rpc(customer.token, 'can_review', { p_product_id: p.id })).data
  rec(
    'T4-01',
    !notBought.ok &&
      errMsg(notBought).includes('đã nhận hàng') &&
      !notDelivered.ok &&
      !anonReview.ok &&
      canBefore === false,
    `chưa mua: ${notBought.status} "${errMsg(notBought)}"; đơn đang giao: ${notDelivered.status}; chưa đăng nhập: ${anonReview.status}; can_review=${canBefore}`,
  )

  await mkOrder(customer, 'completed')
  const canAfter = (await rpc(customer.token, 'can_review', { p_product_id: p.id })).data
  const first = await review(customer.token, {
    rating: 4,
    comment: '<script>alert(1)</script>\r\n\r\n\r\n\r\nDòng 2',
  })
  const r1 = first.data?.[0]
  const second = await review(customer.token, { rating: 1 })
  rec(
    'T4-02',
    canAfter === true &&
      first.ok &&
      r1?.author_name === 'RLS K.' &&
      r1?.comment === '<script>alert(1)</script>\n\nDòng 2' &&
      !second.ok &&
      errMsg(second).includes('đã đánh giá'),
    `có đơn Hoàn tất: can_review=${canAfter}, đánh giá: ${first.status}, tên "${r1?.author_name}", nhận xét ${JSON.stringify(r1?.comment)}; lần 2: ${second.status} "${errMsg(second)}"`,
  )

  const selfHide = await api(customer.token, `/rest/v1/reviews?id=eq.${r1.id}`, {
    method: 'PATCH',
    body: { hidden: true },
  })
  const selfMove = await api(customer.token, `/rest/v1/reviews?id=eq.${r1.id}`, {
    method: 'PATCH',
    body: { product_id: pActiveA.id },
  })
  const edit = await api(customer.token, `/rest/v1/reviews?id=eq.${r1.id}`, {
    method: 'PATCH',
    body: { rating: 5 },
  })
  const otherEdit = await api(seller.token, `/rest/v1/reviews?id=eq.${r1.id}`, {
    method: 'PATCH',
    body: { rating: 1 },
  })
  const selfDelete = await api(customer.token, `/rest/v1/reviews?id=eq.${r1.id}`, {
    method: 'DELETE',
  })
  rec(
    'T4-03',
    !selfHide.ok &&
      !selfMove.ok &&
      edit.ok &&
      edit.data[0]?.rating === 5 &&
      edit.data[0]?.updated_at &&
      otherEdit.data?.length === 0 &&
      selfDelete.data?.length === 0,
    `khách tự ẩn: ${selfHide.status}, chuyển sang sản phẩm khác: ${selfMove.status}; sửa số sao: ${edit.status} → ${edit.data?.[0]?.rating}; người khác sửa ${otherEdit.data?.length} dòng; tự xóa ${selfDelete.data?.length} dòng`,
  )

  const shown = await rating()
  const custHide = await rpc(customer.token, 'set_review_hidden', { p_id: r1.id, p_hidden: true })
  const sellerHide = await rpc(seller.token, 'set_review_hidden', { p_id: r1.id, p_hidden: true })
  const adminHide = await rpc(admin.token, 'set_review_hidden', { p_id: r1.id, p_hidden: true })
  const hiddenRating = await rating()
  const anonSee = (await api(null, `/rest/v1/reviews?select=id&product_id=eq.${p.id}`)).data.length
  const ownerSee = (await api(customer.token, `/rest/v1/reviews?select=id&product_id=eq.${p.id}`))
    .data.length
  const adminSee = (await api(admin.token, `/rest/v1/reviews?select=id&product_id=eq.${p.id}`)).data
    .length
  await rpc(admin.token, 'set_review_hidden', { p_id: r1.id, p_hidden: false })
  const shopRating = (await rpc(null, 'shop_rating', { p_shop_id: shopA.id })).data?.[0]
  rec(
    'T4-04',
    Number(shown?.rating_avg) === 5 &&
      shown?.rating_count === 1 &&
      !custHide.ok &&
      !sellerHide.ok &&
      adminHide.ok &&
      hiddenRating === null &&
      anonSee === 0 &&
      ownerSee === 1 &&
      adminSee === 1 &&
      Number(shopRating?.rating_avg) === 5 &&
      shopRating?.rating_count === 1,
    `điểm ${shown?.rating_avg} (${shown?.rating_count}); khách ẩn: ${custHide.status}, người bán ẩn: ${sellerHide.status}, admin ẩn: ${adminHide.status} → điểm ${JSON.stringify(hiddenRating)}; thấy đánh giá đã ẩn: chưa đăng nhập ${anonSee}, người viết ${ownerSee}, admin ${adminSee}; điểm shop sau khi hiện lại ${shopRating?.rating_avg} (${shopRating?.rating_count})`,
  )

  const comment = (token, body) =>
    api(token, '/rest/v1/comments', { method: 'POST', body: { product_id: p.id, ...body } })
  const anonAsk = await comment(null, { body: 'Hỏi' })
  const blank = await comment(customer.token, { body: '   \n  ' })
  const tooLong = await comment(customer.token, { body: 'a'.repeat(1001) })
  const ask = await comment(customer.token, { body: '  <img src=x onerror=alert(1)>  ' })
  const q = ask.data?.[0]
  const sneakyHidden = await comment(customer.token, { body: 'Ẩn sẵn', hidden: true })
  const pendingAsk = await api(customer.token, '/rest/v1/comments', {
    method: 'POST',
    body: { product_id: pPendingA.id, body: 'Hỏi hàng chờ duyệt' },
  })
  rec(
    'T4-05',
    !anonAsk.ok &&
      !blank.ok &&
      !tooLong.ok &&
      ask.ok &&
      q?.body === '<img src=x onerror=alert(1)>' &&
      q?.author_name === 'RLS K.' &&
      !sneakyHidden.ok &&
      !pendingAsk.ok,
    `chưa đăng nhập hỏi: ${anonAsk.status}; chỉ khoảng trắng: ${blank.status}; 1001 ký tự: ${tooLong.status}; hỏi: ${ask.status} → ${JSON.stringify(q?.body)}; tự gửi hidden: ${sneakyHidden.status}; hỏi sản phẩm chờ duyệt: ${pendingAsk.status}`,
  )

  const unansweredBefore = (await rpc(seller.token, 'seller_unanswered_questions')).data
  const otherSellerList = (await rpc(seller2.token, 'seller_unanswered_questions')).data
  const fakeSeller = await comment(seller2.token, {
    parent_id: q.id,
    body: 'Shop B',
    is_seller: true,
  })
  const plainReply = await comment(seller2.token, { parent_id: q.id, body: 'Tôi cũng muốn biết' })
  const custLabel = await comment(customer.token, { parent_id: q.id, body: 'Giả', is_seller: true })
  const sellerAsk = await comment(seller.token, { body: 'Câu hỏi có nhãn', is_seller: true })
  const reply = await comment(seller.token, { parent_id: q.id, body: 'Còn hàng', is_seller: true })
  const nested = await comment(customer.token, {
    parent_id: reply.data?.[0]?.id,
    body: 'Trả lời 2 cấp',
  })
  rec(
    'T4-06',
    !fakeSeller.ok &&
      plainReply.ok &&
      plainReply.data[0]?.is_seller === false &&
      !custLabel.ok &&
      !sellerAsk.ok &&
      reply.ok &&
      reply.data[0]?.author_name === shopA.name &&
      !nested.ok,
    `shop khác trả lời có nhãn: ${fakeSeller.status}, không nhãn: ${plainReply.status}; khách gắn nhãn: ${custLabel.status}; người bán đặt câu hỏi có nhãn: ${sellerAsk.status}; chủ shop trả lời: ${reply.status} tên "${reply.data?.[0]?.author_name}"; trả lời 2 cấp: ${nested.status}`,
  )

  const unansweredAfter = (await rpc(seller.token, 'seller_unanswered_questions')).data
  const anonList = await rpc(null, 'seller_unanswered_questions')
  // Sản phẩm bị ẩn thì không trả lời được nữa → câu hỏi của nó không nằm trong danh sách (BUG-G2T4-02).
  const pHideLater = await mkProduct(shopA, 'A-se-an', 'active')
  const askHidden = await api(customer.token, '/rest/v1/comments', {
    method: 'POST',
    body: { product_id: pHideLater.id, body: 'Hỏi trước khi ẩn' },
  })
  await svc(`/rest/v1/products?id=eq.${pHideLater.id}`, {
    method: 'PATCH',
    body: { status: 'hidden' },
  })
  const hiddenProductListed = (await rpc(seller.token, 'seller_unanswered_questions')).data?.some(
    (c) => c.id === askHidden.data?.[0]?.id,
  )
  rec(
    'T4-07',
    unansweredBefore?.some((c) => c.id === q.id) &&
      !otherSellerList?.some((c) => c.id === q.id) &&
      !unansweredAfter?.some((c) => c.id === q.id) &&
      !anonList.ok &&
      askHidden.ok &&
      hiddenProductListed === false,
    `câu hỏi chưa trả lời: chủ shop thấy ${unansweredBefore?.some((c) => c.id === q.id)}, shop khác thấy ${otherSellerList?.some((c) => c.id === q.id)}; sau khi trả lời còn trong danh sách ${unansweredAfter?.some((c) => c.id === q.id)}; chưa đăng nhập gọi: ${anonList.status}; câu hỏi của sản phẩm đã ẩn còn trong danh sách ${hiddenProductListed}`,
  )

  const thread = (token) =>
    api(token, `/rest/v1/comments?select=id&product_id=eq.${p.id}`).then((r) => r.data.length)
  const custHideC = await rpc(customer.token, 'set_comment_hidden', { p_id: q.id, p_hidden: true })
  const patchHide = await api(customer.token, `/rest/v1/comments?id=eq.${q.id}`, {
    method: 'PATCH',
    body: { hidden: true },
  })
  const editBody = await api(customer.token, `/rest/v1/comments?id=eq.${q.id}`, {
    method: 'PATCH',
    body: { body: 'Sửa' },
  })
  const delOther = await api(seller.token, `/rest/v1/comments?id=eq.${q.id}`, { method: 'DELETE' })
  const adminHideC = await rpc(admin.token, 'set_comment_hidden', { p_id: q.id, p_hidden: true })
  const anonCount = await thread(null)
  const custCount = await thread(customer.token)
  const adminCount = await thread(admin.token)
  const replyToHidden = await comment(customer.token, {
    parent_id: q.id,
    body: 'Trả lời câu đã ẩn',
  })
  rec(
    'T4-08',
    !custHideC.ok &&
      !patchHide.ok &&
      !editBody.ok &&
      delOther.data?.length === 0 &&
      adminHideC.ok &&
      anonCount === 0 &&
      custCount === 0 &&
      adminCount === 3 &&
      !replyToHidden.ok,
    `khách ẩn qua hàm: ${custHideC.status}, sửa thẳng cột hidden: ${patchHide.status}, sửa nội dung: ${editBody.status}; người bán xóa ${delOther.data?.length} dòng; admin ẩn câu hỏi: ${adminHideC.status} → chưa đăng nhập thấy ${anonCount}, khách thấy ${custCount}, admin thấy ${adminCount}/3 (câu hỏi + 2 trả lời); trả lời câu đã ẩn: ${replyToHidden.status}`,
  )

  // Đơn chặn xóa sản phẩm / shop / tài khoản → xóa trước phần dọn dẹp chung.
  await svc(`/rest/v1/orders?shop_id=eq.${shopA.id}`, { method: 'DELETE' })
}

// ---------- Dọn dẹp ----------
for (const u of testUsers) {
  for (const s of (await svc(`/rest/v1/shops?select=id&owner_id=eq.${u.id}`)).data) {
    await svc(`/rest/v1/products?shop_id=eq.${s.id}`, { method: 'DELETE' })
    await svc(`/rest/v1/shops?id=eq.${s.id}`, { method: 'DELETE' })
  }
  const del = await svc(`/auth/v1/admin/users/${u.id}`, { method: 'DELETE' })
  if (!del.ok) console.log('Không xóa được', u.email, del.status, JSON.stringify(del.data))
}
const leftBrands = await svc(`/rest/v1/brands?slug=like.rls-*-${ts}`, { method: 'DELETE' })
console.log(`\nDọn dẹp xong (thương hiệu test lọt vào DB: ${leftBrands.data?.length ?? 0})`)
const passed = results.filter((r) => r.ok).length
console.log(`${passed}/${results.length} đạt`)
process.exitCode = passed === results.length ? 0 : 1
