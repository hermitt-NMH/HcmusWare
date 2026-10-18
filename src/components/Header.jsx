import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { getCategories } from '../lib/api'
import { useAsync } from '../hooks/useAsync'

const navClass = ({ isActive }) =>
  `block rounded-md px-3 py-2 text-sm font-medium ${
    isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'
  }`

export default function Header() {
  const [open, setOpen] = useState(false)
  const { data: categories } = useAsync(getCategories)
  const close = () => setOpen(false)

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <button
          type="button"
          className="rounded-md p-2 text-slate-600 hover:bg-slate-100 md:hidden"
          aria-label="Mở menu danh mục"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d={open ? 'M6 6l12 12M18 6L6 18' : 'M4 7h16M4 12h16M4 17h16'} strokeLinecap="round" />
          </svg>
        </button>

        <Link to="/" className="flex items-center gap-2 font-bold text-slate-900" onClick={close}>
          <img src="/logo.svg" alt="" width="28" height="28" />
          <span>PC Parts</span>
        </Link>

        <nav className="ml-auto flex items-center gap-1">
          <NavLink to="/build-pc" className={navClass}>
            Build PC
          </NavLink>
          <NavLink to="/gio-hang" className={navClass}>
            Giỏ hàng
          </NavLink>
          <NavLink to="/dang-nhap" className={`${navClass({ isActive: false })} hidden sm:block`}>
            Đăng nhập
          </NavLink>
        </nav>
      </div>

      {/* Menu danh mục: thanh ngang trên máy tính, danh sách xổ xuống trên điện thoại */}
      <div className={`${open ? 'block' : 'hidden'} border-t border-slate-100 md:block`}>
        <ul className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-2 md:flex-row md:overflow-x-auto">
          {categories?.map((c) => (
            <li key={c.id} className="shrink-0">
              <NavLink to={`/danh-muc/${c.slug}`} className={navClass} onClick={close}>
                {c.name}
              </NavLink>
            </li>
          ))}
          <li className="sm:hidden">
            <NavLink to="/dang-nhap" className={navClass} onClick={close}>
              Đăng nhập
            </NavLink>
          </li>
        </ul>
      </div>
    </header>
  )
}
