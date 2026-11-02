// Vẽ sẵn HTML của trang lúc build (#115), chỉ dùng trong scripts/prerender.js (vite build --ssr).
// Cây component giống hệt main.jsx, chỉ đổi BrowserRouter → StaticRouter và SsrDataContext có store.
import { StrictMode } from 'react'
import { prerenderToNodeStream } from 'react-dom/static'
import { StaticRouter } from 'react-router'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext'
import { CartProvider } from './context/CartContext'
import { SsrDataContext, createSsrStore, snapshotScript } from './lib/ssrData'

async function renderOnce(url, store, timeoutMs) {
  const errors = []
  const { prelude } = await prerenderToNodeStream(
    <StrictMode>
      <SsrDataContext value={store}>
        <StaticRouter location={url}>
          <AuthProvider>
            <CartProvider>
              <App />
            </CartProvider>
          </AuthProvider>
        </StaticRouter>
      </SsrDataContext>
    </StrictMode>,
    {
      signal: AbortSignal.timeout(timeoutMs),
      onError: (e) => errors.push(e),
      // Mặc định React tách khối Suspense lớn hơn ~12 KB ra cuối trang để hiện dần (stream);
      // trang vẽ sẵn đã đủ dữ liệu nên giữ nguyên chỗ, trình duyệt vẽ ngay khi đọc tới
      progressiveChunkSize: Infinity,
    },
  )
  let html = ''
  for await (const chunk of prelude) html += chunk
  if (errors.length) throw errors[0]
  return html
}

// Trả về { html, script }: html đặt vào <div id="root">, script là dữ liệu đã chụp cho useAsync.
// Phần nào phải chờ (dữ liệu, trang lazy) thì React đặt vào <div hidden> rồi mới hiện bằng script ở cuối
// trang → trình duyệt vẽ muộn. Nên vẽ lại khi mọi thứ đã có sẵn (store giữ promise đã xong, lazy đã tải)
// cho tới khi không còn ranh giới Suspense nào đang chờ (<!--$?-->).
export async function render(url, { timeoutMs = 30000, maxPasses = 4 } = {}) {
  const store = createSsrStore()
  let html
  for (let pass = 0; pass < maxPasses; pass++) {
    html = await renderOnce(url, store, timeoutMs)
    if (!html.includes('<!--$?-->')) break
  }
  return { html, script: snapshotScript(store) }
}
