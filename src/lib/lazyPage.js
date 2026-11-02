import { createElement, use, useContext } from 'react'
import { SsrDataContext } from './ssrData'

// Thay cho React.lazy ở những trang/khối tải sau (#115). Khác React.lazy ở chỗ tải trước được:
// trang vẽ sẵn lúc build ghi tên các khối lazy đã dùng (window.__hcmLazy, xem ssrData.js), main.jsx
// gọi preloadLazy() cho từng tên rồi mới hydrate. Nếu hydrate khi code của trang chưa về, React giữ
// HTML cũ chờ code; lúc đó giỏ hàng / đăng nhập đổi state là React bỏ HTML vẽ sẵn, hiện "Đang tải…"
// rồi vẽ lại từ đầu (chớp trang, LCP muộn).
// name: tên duy nhất, giữ nguyên giữa các lần build (ghi vào HTML).
const loaders = new Map()

export function lazyPage(name, factory) {
  let Component = null
  let promise = null
  const load = () =>
    (promise ??= factory().then((m) => {
      Component = m.default
      return Component
    }))
  loaders.set(name, load)

  function LazyPage(props) {
    useContext(SsrDataContext)?.lazy.add(name)
    // Đã tải thì vẽ luôn, không thì chờ (Suspense bên ngoài hiện fallback như React.lazy)
    return createElement(Component ?? use(load()), props)
  }
  LazyPage.displayName = `Lazy(${name})`
  return LazyPage
}

// Tải trước code của khối lazy theo tên; tên lạ (HTML của bản build cũ) thì bỏ qua.
export function preloadLazy(name) {
  return loaders.get(name)?.() ?? Promise.resolve()
}
