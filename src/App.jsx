import { Suspense, lazy } from 'react'
import { Route, Routes } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import Home from './pages/Home'
import Products from './pages/Products'
import ProductDetail from './pages/ProductDetail'
import NotFound from './pages/NotFound'
import PriceAlertNotifier from './features/price/PriceAlertNotifier'

// Trang ít người mở ngay từ đầu thì tải sau (lazy): mở trang chủ không phải tải code của chúng.
// Thêm trang mới (Builder, admin...) cũng nên khai báo kiểu này.
const Login = lazy(() => import('./pages/Login'))
const Account = lazy(() => import('./pages/Account'))
const Privacy = lazy(() => import('./pages/Privacy'))
const Builder = lazy(() => import('./pages/Builder'))
const Cart = lazy(() => import('./pages/Cart'))
const Checkout = lazy(() => import('./pages/Checkout'))
const MockPayment = lazy(() => import('./pages/MockPayment'))
const OrderDetail = lazy(() => import('./pages/OrderDetail'))
const Admin = lazy(() => import('./pages/admin/Admin'))

// Hiện trong lúc tải code của trang lazy (thường chỉ chớp nhoáng).
const PageLoading = <p className="py-16 text-center text-slate-500">Đang tải…</p>

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <PriceAlertNotifier />
      {/* min-h-dvh: Footer luôn nằm dưới màn hình đầu tiên, không bị đẩy xuống khi dữ liệu tải xong (CLS) */}
      <main className="mx-auto min-h-dvh w-full max-w-6xl flex-1 px-4 py-6">
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
            <Route path="/build-pc" element={<Builder />} />
            <Route path="/gio-hang" element={<Cart />} />
            <Route path="/thanh-toan" element={<Checkout />} />
            <Route path="/thanh-toan/mo-phong/:id" element={<MockPayment />} />
            <Route path="/don-hang/:id" element={<OrderDetail />} />
            <Route path="/admin/*" element={<Admin />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
