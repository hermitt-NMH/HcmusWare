import { Suspense, lazy } from 'react'
import { Route, Routes } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import Home from './pages/Home'
import Products from './pages/Products'
import ProductDetail from './pages/ProductDetail'
import ComingSoon from './pages/ComingSoon'
import NotFound from './pages/NotFound'

// Trang ít người mở ngay từ đầu thì tải sau (lazy): mở trang chủ không phải tải code của chúng.
// Thêm trang mới (Builder, admin...) cũng nên khai báo kiểu này.
const Login = lazy(() => import('./pages/Login'))
const Account = lazy(() => import('./pages/Account'))
const Privacy = lazy(() => import('./pages/Privacy'))

// Hiện trong lúc tải code của trang lazy (thường chỉ chớp nhoáng).
const PageLoading = <p className="py-16 text-center text-slate-500">Đang tải…</p>

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Suspense fallback={PageLoading}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/san-pham" element={<Products />} />
            <Route path="/danh-muc/:slug" element={<Products />} />
            <Route path="/san-pham/:id" element={<ProductDetail />} />
            {/* key khác nhau để chuyển qua lại đăng nhập ↔ đăng ký thì form được làm mới */}
            <Route path="/dang-nhap" element={<Login key="login" mode="login" />} />
            <Route path="/dang-ky" element={<Login key="register" mode="register" />} />
            <Route path="/tai-khoan" element={<Account />} />
            <Route path="/chinh-sach-bao-mat" element={<Privacy />} />
            {/* Các trang dưới đây làm ở Tuần 4–5 */}
            <Route path="/build-pc" element={<ComingSoon title="Build PC" />} />
            <Route path="/gio-hang" element={<ComingSoon title="Giỏ hàng" />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
