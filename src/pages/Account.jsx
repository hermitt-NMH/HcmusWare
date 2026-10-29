import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import OrderHistory from '../features/orders/OrderHistory'
import SavedBuilds from '../features/builder/SavedBuilds'
import MyPriceAlerts from '../features/price/MyPriceAlerts'
import MyShopCard from '../features/seller/MyShopCard'
import { PHONE_RE } from '../features/orders/orders'
import { roleLabel, roleShortcut } from '../lib/roles'

const inputClass =
  'h-11 w-full rounded-lg border border-slate-300 bg-surface px-3 text-sm focus:border-blue-500 focus:outline-none'

// Trang tài khoản: hồ sơ giao hàng, lịch sử đơn hàng, cấu hình đã lưu, cảnh báo giá, đăng xuất.
// Số điện thoại để trống cũng được (PHONE_RE dùng chung với trang thanh toán).
export default function Account() {
  const { user, profile, role, loading, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  // Link có #cau-hinh / #canh-bao-gia: React Router không tự cuộn tới, nên cuộn tay.
  useEffect(() => {
    if (!user || !location.hash) return
    document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: 'start' })
  }, [user, location.hash])

  if (loading) return <p className="py-16 text-center text-slate-500">Đang kiểm tra đăng nhập…</p>
  // Chưa đăng nhập → sang trang đăng nhập, xong quay lại đây.
  if (!user)
    return <Navigate to={`/dang-nhap?next=${encodeURIComponent(location.pathname)}`} replace />

  const shortcut = roleShortcut(role)
  const handleSignOut = async () => {
    await signOut()
    navigate('/', { replace: true })
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Tài khoản của tôi</h1>
          <p className="truncate text-sm text-slate-500">{user.email}</p>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className="h-11 rounded-lg border border-slate-300 bg-surface px-4 text-sm font-medium hover:bg-slate-50"
        >
          Đăng xuất
        </button>
      </div>

      {shortcut && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          <span>Bạn đang dùng tài khoản {roleLabel(role).toLowerCase()}.</span>
          <Link
            to={shortcut.to}
            className="inline-flex h-10 items-center rounded-lg bg-amber-700 px-4 font-semibold text-white hover:bg-orange-800"
          >
            Vào {shortcut.label.toLowerCase()}
          </Link>
        </div>
      )}

      {location.state?.notice && (
        <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
          {location.state.notice}
        </p>
      )}

      {/* Shop của tôi: mở shop, chờ duyệt, bị từ chối (Giai đoạn 2 – F14) */}
      <MyShopCard />

      {/* key: khi hồ sơ tải xong thì form khởi tạo lại với dữ liệu mới */}
      <ProfileForm key={profile?.id ?? 'loading'} />

      {/* Sổ địa chỉ (Giai đoạn 2 – F17): thay cho ô địa chỉ tự do trong hồ sơ */}
      <Link
        to="/tai-khoan/dia-chi"
        className="flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-surface p-5 hover:bg-slate-50 sm:p-6"
      >
        <span>
          <span className="block text-lg font-semibold">Sổ địa chỉ</span>
          <span className="block text-sm text-slate-500">
            Lưu tối đa 10 địa chỉ nhận hàng, địa chỉ mặc định được điền sẵn khi thanh toán.
          </span>
        </span>
        <span aria-hidden="true" className="text-xl text-slate-500">
          ›
        </span>
      </Link>

      <OrderHistory userId={user.id} />
      <div id="cau-hinh" className="scroll-mt-36">
        <SavedBuilds userId={user.id} />
      </div>
      <MyPriceAlerts userId={user.id} />
    </div>
  )
}

function ProfileForm() {
  const { profile, updateProfile } = useAuth()
  const [form, setForm] = useState({
    full_name: profile?.full_name ?? '',
    phone: profile?.phone ?? '',
  })
  const [status, setStatus] = useState({ type: '', message: '' })
  const [saving, setSaving] = useState(false)

  const set = (key) => (e) => {
    setForm({ ...form, [key]: e.target.value })
    setStatus({ type: '', message: '' })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const data = {
      full_name: form.full_name.trim(),
      phone: form.phone.replace(/[\s.-]/g, ''), // cho phép gõ "090 123 4567"
    }
    if (!data.full_name) return setStatus({ type: 'error', message: 'Vui lòng nhập họ tên.' })
    if (data.phone && !PHONE_RE.test(data.phone)) {
      return setStatus({ type: 'error', message: 'Số điện thoại không hợp lệ (vd 0901234567).' })
    }

    setSaving(true)
    const { error } = await updateProfile(data)
    setSaving(false)
    setStatus(
      error
        ? { type: 'error', message: `Không lưu được: ${error.message}` }
        : { type: 'success', message: 'Đã lưu thông tin.' },
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl border border-slate-200 bg-surface p-5 sm:p-6"
    >
      <div>
        <h2 className="text-lg font-semibold">Thông tin cá nhân</h2>
        <p className="text-sm text-slate-500">
          Điền sẵn tên và số điện thoại khi bạn thêm địa chỉ nhận hàng mới.
        </p>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Họ và tên</span>
        <input
          className={inputClass}
          autoComplete="name"
          value={form.full_name}
          onChange={set('full_name')}
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Số điện thoại</span>
        <input
          className={inputClass}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="0901234567"
          value={form.phone}
          onChange={set('phone')}
        />
      </label>

      {status.message && (
        <p
          role={status.type === 'error' ? 'alert' : 'status'}
          className={`rounded-lg p-3 text-sm ${status.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-800'}`}
        >
          {status.message}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="h-11 w-full rounded-lg bg-blue-600 px-6 font-semibold text-white hover:bg-blue-700 disabled:opacity-60 sm:w-auto"
      >
        {saving ? 'Đang lưu…' : 'Lưu thay đổi'}
      </button>
    </form>
  )
}
