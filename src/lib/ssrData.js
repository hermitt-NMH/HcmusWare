import { createContext } from 'react'

// Dữ liệu vẽ sẵn lúc build (scripts/prerender.js, #115).
// - Lúc build: entry-server.jsx đặt SsrDataContext = createSsrStore(); useAsync chờ dữ liệu bằng use(),
//   kết quả ghi vào store.data theo useId của từng lần gọi useAsync.
// - Trong trình duyệt: store.data nằm ở window.__hcmData (script ngay sau <div id="root">); lần hydrate
//   đầu, useAsync lấy luôn dữ liệu này thay vì hiện "đang tải", rồi vẫn gọi DB lấy dữ liệu mới.
// useId giống nhau giữa lúc build và lúc hydrate vì cây component giống nhau (main.jsx bọc cùng Provider).
export const SsrDataContext = createContext(null)

export const SNAPSHOT_GLOBAL = '__hcmData'
// Tên các khối lazyPage() trang đã dùng – main.jsx tải trước rồi mới hydrate (lib/lazyPage.js)
export const LAZY_GLOBAL = '__hcmLazy'

// Kết quả đã chụp của lần gọi useAsync có mã id; deps (key) khác thì không dùng.
export function readSnapshot(id, key) {
  const entry = globalThis.window?.[SNAPSHOT_GLOBAL]?.[id]
  return entry && entry.k === key ? entry : null
}

// Store cho một lần vẽ trang lúc build. Gọi lỗi thì trang để trạng thái "đang tải" như cũ, không ghi lại.
export function createSsrStore() {
  const promises = new Map()
  const data = {}
  return {
    data,
    lazy: new Set(),
    load(id, key, fn) {
      const cacheKey = `${id} ${key}`
      if (!promises.has(cacheKey))
        promises.set(
          cacheKey,
          Promise.resolve()
            .then(fn)
            .then(
              (value) => {
                data[id] = { k: key, d: value ?? null }
                return { ok: true, data: value ?? null }
              },
              () => ({ ok: false }),
            ),
        )
      return promises.get(cacheKey)
    },
  }
}

// JSON đặt trong <script>: đổi "<" để chuỗi trong dữ liệu (vd "</script>") không đóng thẻ sớm.
export function snapshotScript(store) {
  const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c')
  return `<script>window.${SNAPSHOT_GLOBAL}=${json(store.data)};window.${LAZY_GLOBAL}=${json([...store.lazy])}</script>`
}
