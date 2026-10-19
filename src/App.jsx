import { Route, Routes } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import Home from './pages/Home'
import Products from './pages/Products'
import ProductDetail from './pages/ProductDetail'
import ComingSoon from './pages/ComingSoon'
import NotFound from './pages/NotFound'

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
          {/* Các trang dưới đây làm ở Tuần 4–5 */}
          <Route path="/build-pc" element={<ComingSoon title="Build PC" />} />
          <Route path="/gio-hang" element={<ComingSoon title="Giỏ hàng" />} />
          <Route path="/dang-nhap" element={<ComingSoon title="Đăng nhập" />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}
