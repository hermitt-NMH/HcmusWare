import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { getCategories } from '../lib/api'
import { useAsync } from '../hooks/useAsync'
import { useAuth } from '../hooks/useAuth'
import { useCart } from '../hooks/useCart'

const navClass = ({ isActive }) =>
  // flex + min-h-11: vùng bấm cao tối thiểu 44px; whitespace-nowrap: chữ không bị ngắt 2 dòng.
  // Màn nhỏ dùng px-2 cho đủ chỗ ở 360px, từ sm trở lên mới px-3.
  `flex min-h-11 items-center whitespace-nowrap rounded-md px-2 py-2 text-sm font-medium sm:px-3 ${
    isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'
  }`

// Ô tìm kiếm: gõ tên rồi Enter → sang /san-pham?q=...
function SearchForm({ className = '', onDone }) {
  const [q, setQ] = useState('')
  const navigate = useNavigate()
  const submit = (e) => {
    e.preventDefault()
    const text = q.trim()
    navigate(text ? `/san-pham?q=${encodeURIComponent(text)}` : '/san-pham')
    setQ('')
    onDone?.()
  }
  return (
    <form role="search" onSubmit={submit} className={className}>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Tìm CPU, VGA, RAM..."
        aria-label="Tìm sản phẩm"
        className="h-11 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm focus:border-blue-500 focus:bg-white focus:outline-none"
      />
    </form>
  )
}

export default function Header() {
  const [open, setOpen] = useState(false)
  const categories = useAsync(getCategories)
  const { user, profile, isAdmin } = useAuth()
  const { count } = useCart()
  const close = () => setOpen(false)

  // Đã đăng nhập: hiện tên (từ cuối của họ tên, vd "Nguyễn Văn An" → "An") và dẫn tới trang tài khoản.
  const firstName = profile?.full_name?.trim().split(/\s+/).pop()
  const account = user
    ? { to: '/tai-khoan', label: firstName || 'Tài khoản' }
    : { to: '/dang-nhap', label: 'Đăng nhập' }

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
      {/* px-3 ở điện thoại: px-4 làm thanh này rộng 364px, tràn màn 360px (BUG-05) */}
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-3 sm:gap-3 sm:px-4">
        <button
          type="button"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 md:hidden"
          aria-label="Mở menu danh mục"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              d={open ? 'M6 6l12 12M18 6L6 18' : 'M4 7h16M4 12h16M4 17h16'}
              strokeLinecap="round"
            />
          </svg>
        </button>

        <Link
          to="/"
          className="inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap font-bold text-slate-900"
          onClick={close}
        >
          <img src="/logo.svg" alt="" width="28" height="28" />
          <span>HcmusWare</span>
        </Link>

        <SearchForm className="mx-2 hidden max-w-md flex-1 md:block" />

        <nav className="ml-auto flex items-center gap-1">
          {/* Lối tắt cho admin, chỉ trên màn rộng (điện thoại vào qua trang Tài khoản) */}
          {isAdmin && (
            <NavLink to="/admin" className={(s) => `${navClass(s)} hidden lg:flex`}>
              Quản trị
            </NavLink>
          )}
          <NavLink to="/build-pc" className={navClass}>
            Build PC
          </NavLink>
          {/* Điện thoại chỉ hiện icon để header không tràn 360px (BUG-05); từ sm mới hiện chữ */}
          <NavLink to="/gio-hang" className={navClass} aria-label={`Giỏ hàng, ${count} sản phẩm`}>
            <svg
              className="sm:hidden"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="9" cy="20" r="1.5" />
              <circle cx="18" cy="20" r="1.5" />
              <path d="M2 3h3l2.7 12.4a1 1 0 0 0 1 .8h9.6a1 1 0 0 0 1-.8L21 7H6" />
            </svg>
            <span className="hidden sm:inline">Giỏ hàng</span>
            {count > 0 && (
              <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white">
                {count > 99 ? '99+' : count}
              </span>
            )}
          </NavLink>
          <NavLink to={account.to} className={(s) => `${navClass(s)} hidden max-w-32 sm:flex`}>
            <span className="truncate">{account.label}</span>
          </NavLink>
        </nav>
      </div>

      {/* Menu danh mục: thanh ngang trên máy tính, danh sách xổ xuống trên điện thoại */}
      <div className={`${open ? 'block' : 'hidden'} border-t border-slate-100 md:block`}>
        <SearchForm className="mx-auto max-w-6xl px-4 pt-3 md:hidden" onDone={close} />
        <ul className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-2 md:flex-row md:overflow-x-auto">
          {/* Đang tải: chữ nhỏ; lỗi: báo gọn một dòng. Giữ cùng chiều cao để không vỡ thanh menu */}
          {categories.loading && (
            <li className="flex min-h-11 items-center px-3 text-xs text-slate-400">
              Đang tải danh mục…
            </li>
          )}
          {categories.error && (
            <li className="flex min-h-11 items-center px-3 text-xs text-red-600">
              Không tải được danh mục
            </li>
          )}
          {categories.data?.map((c) => (
            <li key={c.id} className="shrink-0">
              <NavLink to={`/danh-muc/${c.slug}`} className={navClass} onClick={close}>
                {c.name}
              </NavLink>
            </li>
          ))}
          <li className="sm:hidden">
            <NavLink to={account.to} className={navClass} onClick={close}>
              {account.label}
            </NavLink>
          </li>
        </ul>
      </div>
    </header>
  )
}
