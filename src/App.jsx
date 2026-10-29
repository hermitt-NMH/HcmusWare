import { Suspense, lazy } from 'react'
import { Route, Routes } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import Home from './pages/Home'
import Products from './pages/Products'
import ProductDetail from './pages/ProductDetail'
import NotFound from './pages/NotFound'
import PriceAlertNotifier from './features/price/PriceAlertNotifier'
import RoleRoute from './components/RoleRoute'
import { AREA_ROLES } from './lib/roles'

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
const SellerChannel = lazy(() => import('./pages/seller/SellerChannel'))
const OpenShop = lazy(() => import('./pages/OpenShop'))
const AddressBook = lazy(() => import('./pages/AddressBook'))
const BrandList = lazy(() => import('./pages/BrandList'))
const BrandPage = lazy(() => import('./pages/BrandPage'))
const ShopPage = lazy(() => import('./pages/ShopPage'))
const BudgetSuggest = lazy(() => import('./pages/BudgetSuggest'))

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
            <Route
              path="/tai-khoan/mo-shop"
              element={
                <RoleRoute allow={AREA_ROLES.account}>
                  <OpenShop />
                </RoleRoute>
              }
            />
            <Route
              path="/tai-khoan/dia-chi"
              element={
                <RoleRoute allow={AREA_ROLES.account}>
                  <AddressBook />
                </RoleRoute>
              }
            />
            <Route path="/thuong-hieu" element={<BrandList />} />
            <Route path="/thuong-hieu/:slug" element={<BrandPage />} />
            <Route path="/shop/:slug" element={<ShopPage />} />
            <Route path="/chinh-sach-bao-mat" element={<Privacy />} />
            <Route path="/build-pc" element={<Builder />} />
            <Route path="/goi-y-cau-hinh" element={<BudgetSuggest />} />
            <Route path="/gio-hang" element={<Cart />} />
            <Route path="/thanh-toan" element={<Checkout />} />
            <Route path="/thanh-toan/mo-phong/:id" element={<MockPayment />} />
            <Route path="/don-hang/:id" element={<OrderDetail />} />
            {/* Trang theo vai trò: RoleRoute chặn sai vai trò (bảo vệ thật nằm ở RLS trong DB) */}
            <Route
              path="/admin/*"
              element={
                <RoleRoute allow={AREA_ROLES.admin}>
                  <Admin />
                </RoleRoute>
              }
            />
            <Route
              path="/kenh-nguoi-ban/*"
              element={
                <RoleRoute allow={AREA_ROLES.seller}>
                  <SellerChannel />
                </RoleRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
