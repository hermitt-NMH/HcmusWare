import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import {
  getMyNotifications,
  getUnreadNotificationCount,
  markNotificationsRead,
} from '../../lib/api'
import { ALERTS_CHANGED } from '../price/price'
import { markReadLocally, notificationIcon, safeLink, timeAgo, unreadBadge } from './notifications'

// Chuông thông báo trên Header (F12 – US-12.1, US-12.2), thay thanh "Giá đã giảm" (PriceAlertNotifier).
// Không cần thời gian thực: tải lại khi chuyển trang, quay lại tab, mở chuông, hoặc vừa đặt cảnh báo giá.
// Chưa đăng nhập thì không có chuông.
// Điện thoại: danh sách mở toàn chiều rộng ngay dưới Header (khung định vị là <header> vì
// wrapper chỉ "relative" từ md); máy tính: khung 384px canh phải dưới chuông.
export default function NotificationBell() {
  const { user } = useAuth()
  const userId = user?.id
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [reload, setReload] = useState(0)
  const [list, setList] = useState([])
  const [unread, setUnread] = useState(0)
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    const bump = () => setReload((n) => n + 1)
    window.addEventListener(ALERTS_CHANGED, bump)
    window.addEventListener('focus', bump)
    return () => {
      window.removeEventListener(ALERTS_CHANGED, bump)
      window.removeEventListener('focus', bump)
    }
  }, [])

  // Giữ danh sách cũ trong lúc tải lại để chuông không nháy khi chuyển trang.
  useEffect(() => {
    if (!userId) {
      setList([])
      setUnread(0)
      setLoaded(false)
      return
    }
    let cancelled = false
    Promise.all([getMyNotifications(), getUnreadNotificationCount()])
      .then(([data, count]) => {
        if (cancelled) return
        setList(data)
        setUnread(count)
        setError('')
        setLoaded(true)
      })
      .catch(() => !cancelled && setError('Không tải được thông báo. Thử lại sau.'))
    return () => {
      cancelled = true
    }
  }, [userId, pathname, reload])

  // Chuyển trang thì đóng danh sách.
  useEffect(() => setOpen(false), [pathname])

  // Bấm ra ngoài hoặc nhấn Esc thì đóng.
  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!userId) return null

  const markRead = (ids) => {
    const changed = ids === null ? list.filter((n) => !n.read_at).length : ids.length
    setList((l) => markReadLocally(l, ids))
    setUnread((u) => (ids === null ? 0 : Math.max(0, u - changed)))
    // Lỗi mạng: lần tải sau sẽ hiện lại là chưa đọc, không mất thông báo.
    markNotificationsRead(ids).catch(() => {})
  }

  const toggle = () => {
    if (!open) setReload((n) => n + 1)
    setOpen((v) => !v)
  }

  const badge = unreadBadge(unread)
  const label = unread > 0 ? `Thông báo, ${unread} chưa đọc` : 'Thông báo'

  return (
    <div ref={wrapRef} className="md:relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={label}
        title="Thông báo"
        aria-expanded={open}
        aria-haspopup="true"
        className={`relative inline-flex h-11 w-9 shrink-0 items-center justify-center rounded-md sm:w-11 ${
          open ? 'bg-blue-50 text-blue-700 dark:text-blue-300' : 'text-slate-600 hover:bg-slate-100'
        }`}
      >
        <svg
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
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {badge && (
          <span className="absolute top-1 right-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white">
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div
          role="region"
          aria-label="Danh sách thông báo"
          className="absolute inset-x-0 top-full z-30 border-y border-slate-200 bg-surface shadow-lg md:inset-x-auto md:right-0 md:mt-1 md:w-96 md:rounded-xl md:border"
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-2">
            <h2 className="font-semibold text-slate-900">Thông báo</h2>
            <button
              type="button"
              onClick={() => markRead(null)}
              disabled={!list.some((n) => !n.read_at) && unread === 0}
              className="inline-flex min-h-11 items-center rounded-md px-2 text-sm font-medium text-blue-700 hover:bg-slate-100 disabled:text-slate-400 disabled:hover:bg-transparent dark:text-blue-300 dark:disabled:text-slate-400"
            >
              Đánh dấu tất cả đã đọc
            </button>
          </div>

          <div className="max-h-[70vh] overflow-y-auto overscroll-contain">
            {error && !loaded && (
              <p className="px-4 py-6 text-center text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}
            {!error && !loaded && (
              <p className="px-4 py-6 text-center text-sm text-slate-500">Đang tải…</p>
            )}
            {loaded && !list.length && (
              <p className="px-4 py-6 text-center text-sm text-slate-500">
                Chưa có thông báo nào. Đặt giá mong muốn ở trang sản phẩm để được báo khi giảm giá.
              </p>
            )}
            <ul className="divide-y divide-slate-100">
              {list.map((n) => (
                <li key={n.id}>
                  <NotificationItem
                    n={n}
                    onOpen={() => {
                      if (!n.read_at) markRead([n.id])
                      setOpen(false)
                    }}
                  />
                </li>
              ))}
            </ul>
          </div>

          <div className="border-t border-slate-100 px-4 py-1 text-sm">
            <Link
              to="/tai-khoan#canh-bao-gia"
              className="inline-flex min-h-11 items-center text-slate-600 hover:text-blue-700 dark:hover:text-blue-300"
              onClick={() => setOpen(false)}
            >
              Quản lý cảnh báo giá
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

function NotificationItem({ n, onOpen }) {
  const unread = !n.read_at
  const link = safeLink(n.link)
  const content = (
    <>
      <span aria-hidden="true" className="pt-0.5 text-lg leading-none">
        {notificationIcon(n.type)}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={`block break-words ${unread ? 'font-semibold text-slate-900' : 'text-slate-700'}`}
        >
          {n.title}
        </span>
        {n.body && <span className="mt-0.5 line-clamp-3 break-words text-slate-600">{n.body}</span>}
        <span className="mt-0.5 block text-xs text-slate-500">
          {timeAgo(n.created_at)}
          {unread && <span className="sr-only"> · chưa đọc</span>}
        </span>
      </span>
      {unread && (
        <span aria-hidden="true" className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-600" />
      )}
    </>
  )
  const cls = `flex w-full gap-3 px-4 py-3 text-left text-sm hover:bg-slate-100 ${
    unread ? 'bg-blue-50/60' : ''
  }`
  return link ? (
    <Link to={link} className={cls} onClick={onOpen}>
      {content}
    </Link>
  ) : (
    <button type="button" className={cls} onClick={onOpen}>
      {content}
    </button>
  )
}
