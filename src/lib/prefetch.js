// Gọi sẵn dữ liệu của trang ngay khi HTML vừa tải, song song với lúc trình duyệt tải JS (#179).
// Supabase đặt ở Sydney: mỗi truy vấn từ Việt Nam mất ~0,75 giây đường đi, trước đây chỉ bắt đầu
// sau khi tải + chạy xong JS (~1,3 giây trên điện thoại) nên 2 khoảng cộng dồn vào LCP.
//
// - startPrefetch được vite.config.js chép NGUYÊN VĂN vào <script> trong index.html → không import gì,
//   không dùng import.meta, chỉ cú pháp trình duyệt nào cũng chạy.
// - takePrefetched dùng trong supabase.js (global.fetch): request của supabase-js trùng khớp
//   method + URL + body với một request đã gọi sẵn thì trả luôn kết quả đó (mỗi kết quả dùng 1 lần).
// Chỉ gọi sẵn khi CHƯA đăng nhập (khóa anon): đăng nhập rồi thì RLS theo từng người, để supabase-js tự gọi.
// URL phải khớp từng ký tự với lib/api.js – prefetch.test.js kiểm tra; lệch thì chỉ mất tác dụng, web vẫn chạy.

const PRODUCT_LIST =
  'id,name,brand,price,stock,image_url,specs,categories!inner(slug,name),shops!inner(status,name,slug),brands(name,slug),product_ratings(rating_avg,rating_count)'
const PRODUCT_DETAIL =
  'id,name,brand,price,stock,image_url,images,datasheet_url,description,specs,categories(slug,name),shops!inner(status,name,slug),brands(name,slug),product_ratings(rating_avg,rating_count)'

// Các request trang `pathname` sẽ gọi đầu tiên khi chưa đăng nhập: [method, đường dẫn REST, body]
export function prefetchPlan(pathname) {
  const q = (table, params) => ['GET', `/rest/v1/${table}?${new URLSearchParams(params)}`]
  const list = (extra) =>
    q(
      'products',
      [
        ['select', PRODUCT_LIST],
        ['order', 'created_at.desc,id.desc'],
        ['status', 'eq.active'],
        ['shops.status', 'eq.active'],
      ].concat(extra),
    )
  // Header luôn tải danh mục
  const plan = [
    q('categories', [
      ['select', 'id,name,slug'],
      ['order', 'sort_order.asc'],
    ]),
  ]
  let m
  if (pathname === '/') plan.push(list([['limit', '8']]))
  else if (pathname === '/san-pham') plan.push(list([]))
  else if ((m = /^\/danh-muc\/([^/]+)$/.exec(pathname))) {
    const slug = decodeURIComponent(m[1])
    plan.push(
      q('categories', [
        ['select', 'id,name,slug'],
        ['slug', `eq.${slug}`],
      ]),
    )
    plan.push(list([['categories.slug', `eq.${slug}`]]))
  } else if ((m = /^\/san-pham\/(\d{1,15})$/.exec(pathname)))
    plan.push(
      q('products', [
        ['select', PRODUCT_DETAIL],
        ['id', `eq.${m[1]}`],
        ['status', 'eq.active'],
        ['shops.status', 'eq.active'],
      ]),
    )
  else if ((m = /^\/shop\/([^/]+)$/.exec(pathname)))
    plan.push(
      q('shops', [
        ['select', 'id,name,slug,description,logo_url,created_at'],
        ['slug', `eq.${decodeURIComponent(m[1])}`],
        ['status', 'eq.active'],
      ]),
    )
  else if (pathname === '/thuong-hieu') plan.push(['POST', '/rest/v1/rpc/brand_list', '{}'])
  return plan
}

export function startPrefetch(win, url, anonKey) {
  try {
    if (!url || !anonKey || !win.fetch) return
    // supabase-js lưu phiên ở localStorage với khóa sb-<project>-auth-token
    for (let i = 0; i < win.localStorage.length; i++)
      if (/^sb-.*-auth-token$/.test(win.localStorage.key(i))) return
    const store = {}
    prefetchPlan(win.location.pathname).forEach(function (r) {
      const headers = { apikey: anonKey, Authorization: 'Bearer ' + anonKey }
      if (r[2]) headers['Content-Type'] = 'application/json'
      // Lỗi mạng → trả null, supabase-js tự gọi lại như bình thường
      store[r[0] + ' ' + url + r[1] + ' ' + (r[2] || '')] = win
        .fetch(url + r[1], { method: r[0], headers: headers, body: r[2] })
        .catch(function () {
          return null
        })
    })
    win.__hcmPrefetch = store
    // Quá 15 giây thì bỏ: dữ liệu có thể đã cũ, người dùng cũng đã sang trang khác
    win.setTimeout(function () {
      win.__hcmPrefetch = {}
    }, 15000)
  } catch {
    // localStorage bị chặn (ẩn danh, tắt cookie): bỏ qua, không gọi sẵn
  }
}

// ---- BUNDLE_ONLY: phần dưới chỉ nằm trong bundle JS, vite.config.js không chép vào index.html ----

// fetch cho supabase-js: lấy kết quả gọi sẵn nếu khớp, không thì gọi thật
export function takePrefetched(input, init = {}, anonKey, fetchImpl = fetch) {
  const store = globalThis.__hcmPrefetch
  const auth = new Headers(init.headers).get('authorization')
  const key = `${init.method || 'GET'} ${String(input)} ${typeof init.body === 'string' ? init.body : ''}`
  const hit = store && auth === `Bearer ${anonKey}` ? store[key] : null
  if (!hit) return fetchImpl(input, init)
  delete store[key]
  return hit.then((res) => (res && res.ok ? res : fetchImpl(input, init)))
}
