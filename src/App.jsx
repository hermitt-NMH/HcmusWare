import { Route, Routes } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import Home from './pages/Home'
import Products from './pages/Products'
import ProductDetail from './pages/ProductDetail'
import ComingSoon from './pages/ComingSoon'
import NotFound from './pages/NotFound'
import Login from './pages/Login'
import Account from './pages/Account'

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/san-pham" element={<Products />} />
          <Route path="/danh-muc/:slug" element={<Products />} />
          <Route path="/san-pham/:id" element={<ProductDetail />} />
          {/* key khác nhau để chuyển qua lại đăng nhập ↔ đăng ký thì form được làm mới */}
          <Route path="/dang-nhap" element={<Login key="login" mode="login" />} />
          <Route path="/dang-ky" element={<Login key="register" mode="register" />} />
          <Route path="/tai-khoan" element={<Account />} />
          {/* Các trang dưới đây làm ở Tuần 4–5 */}
          <Route path="/build-pc" element={<ComingSoon title="Build PC" />} />
          <Route path="/gio-hang" element={<ComingSoon title="Giỏ hàng" />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}
