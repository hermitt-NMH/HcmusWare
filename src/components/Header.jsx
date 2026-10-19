import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { getCategories } from '../lib/api'
import { useAsync } from '../hooks/useAsync'
import { useAuth } from '../hooks/useAuth'

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
  const { user, profile } = useAuth()
  const close = () => setOpen(false)

  // Đã đăng nhập: hiện tên (từ cuối của họ tên, vd "Nguyễn Văn An" → "An") và dẫn tới trang tài khoản.
  const firstName = profile?.full_name?.trim().split(/\s+/).pop()
  const account = user
    ? { to: '/tai-khoan', label: firstName || 'Tài khoản' }
    : { to: '/dang-nhap', label: 'Đăng nhập' }

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3 sm:gap-3">
        <button
          type="button"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 md:hidden"
          aria-label="Mở menu danh mục"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d={open ? 'M6 6l12 12M18 6L6 18' : 'M4 7h16M4 12h16M4 17h16'} strokeLinecap="round" />
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
          <NavLink to="/build-pc" className={navClass}>
            Build PC
          </NavLink>
          <NavLink to="/gio-hang" className={navClass}>
            Giỏ hàng
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
            <li className="flex min-h-11 items-center px-3 text-xs text-slate-400">Đang tải danh mục…</li>
          )}
          {categories.error && (
            <li className="flex min-h-11 items-center px-3 text-xs text-red-600">Không tải được danh mục</li>
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
