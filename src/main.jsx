import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext'
import { CartProvider } from './context/CartContext'
import { watchTheme } from './lib/theme'
import { LAZY_GLOBAL, SsrDataContext } from './lib/ssrData'
import { preloadLazy } from './lib/lazyPage'

// Giao diện sáng/tối đã được đặt trong index.html; từ đây chỉ theo dõi thay đổi (cài đặt máy, tab khác).
watchTheme()

// Cây component phải giống hệt entry-server.jsx (kể cả SsrDataContext) để useId khớp lúc hydrate.
const app = (
  <StrictMode>
    <SsrDataContext value={null}>
      <BrowserRouter>
        <AuthProvider>
          <CartProvider>
            <App />
          </CartProvider>
        </AuthProvider>
      </BrowserRouter>
    </SsrDataContext>
  </StrictMode>
)

// Trang đã vẽ sẵn lúc build (scripts/prerender.js, #115) đúng đường dẫn đang mở → hydrate lên HTML đó.
// Có ?query (bộ lọc, mã chia sẻ...) hoặc HTML là trang khác (máy chủ trả index.html cho mọi đường dẫn)
// thì vẽ lại từ đầu như SPA thường.
// Tải xong code các trang/khối lazy mà HTML đã dùng rồi mới hydrate (lib/lazyPage.js); tải lỗi vẫn hydrate.
const root = document.getElementById('root')
if (root.dataset.prerendered === location.pathname && !location.search)
  Promise.allSettled((window[LAZY_GLOBAL] ?? []).map(preloadLazy)).then(() =>
    hydrateRoot(root, app),
  )
else {
  root.textContent = ''
  createRoot(root).render(app)
}
