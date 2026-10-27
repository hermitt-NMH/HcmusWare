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
  const shops = (await svc(`/rest/v1/shops?select=id&owner_id=eq.${u.id}`)).data
  for (const s of shops) {
    await svc(`/rest/v1/products?shop_id=eq.${s.id}`, { method: 'DELETE' })
    await svc(`/rest/v1/shops?id=eq.${s.id}`, { method: 'DELETE' })
  }
  await svc(`/auth/v1/admin/users/${u.id}`, { method: 'DELETE' })
}

const customer = await createUser('khach', 'customer')
const seller = await createUser('ban', 'seller')
const seller2 = await createUser('ban2', 'seller')
const admin = await createUser('admin', 'admin')
console.log('Tài khoản test:', [customer, seller, seller2, admin].map((u) => u.email).join(', '))

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
  // Khóa shop A: khách không thấy hàng của shop, người bán mất quyền ghi
  const lock = await api(admin.token, `/rest/v1/shops?id=eq.${shopA.id}`, {
    method: 'PATCH',
    body: { status: 'locked' },
  })
  const anonSee = await seeProduct(null, pActiveA.id)
  const sellerSee = await seeProduct(seller.token, pActiveA.id)
  const sellerEdit = await api(seller.token, `/rest/v1/products?id=eq.${pActiveA.id}`, {
    method: 'PATCH',
    body: { price: 999000 },
  })
  rec(
    'RLS23',
    lock.data?.length === 1 && !anonSee && sellerSee && sellerEdit.data?.length === 0,
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
    buyOk.ok && Number.isInteger(orderId) && sellerSeesOrder === 0,
    `khách đặt sản phẩm đang bán của shop B: ${buyOk.status} (đơn #${orderId}); người bán B thấy đơn: ${sellerSeesOrder} (Tuần 3 mới mở)`,
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

// ---------- Dọn dẹp ----------
for (const u of [customer, seller, seller2, admin]) {
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
