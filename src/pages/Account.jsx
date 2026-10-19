import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

// Số điện thoại VN: 0xxxxxxxxx hoặc +84xxxxxxxxx (10 số). Để trống cũng được.
const PHONE_RE = /^(0|\+84)\d{9}$/

const inputClass =
  'h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm focus:border-blue-500 focus:outline-none'

// Trang hồ sơ: xem email, sửa họ tên / số điện thoại / địa chỉ giao hàng, đăng xuất.
// Lịch sử đơn hàng thêm vào đây ở Tuần 5.
export default function Account() {
  const { user, profile, loading, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  if (loading) return <p className="py-16 text-center text-slate-500">Đang kiểm tra đăng nhập…</p>
  // Chưa đăng nhập → sang trang đăng nhập, xong quay lại đây.
  if (!user)
    return <Navigate to={`/dang-nhap?next=${encodeURIComponent(location.pathname)}`} replace />

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
          className="h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium hover:bg-slate-50"
        >
          Đăng xuất
        </button>
      </div>

      {profile?.role === 'admin' && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          Bạn đang dùng tài khoản quản trị (admin).
        </p>
      )}

      {/* key: khi hồ sơ tải xong thì form khởi tạo lại với dữ liệu mới */}
      <ProfileForm key={profile?.id ?? 'loading'} />
    </div>
  )
}

function ProfileForm() {
  const { profile, updateProfile } = useAuth()
  const [form, setForm] = useState({
    full_name: profile?.full_name ?? '',
    phone: profile?.phone ?? '',
    address: profile?.address ?? '',
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
      address: form.address.trim(),
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
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
    >
      <div>
        <h2 className="text-lg font-semibold">Thông tin giao hàng</h2>
        <p className="text-sm text-slate-500">Dùng để điền sẵn khi thanh toán.</p>
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
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Địa chỉ</span>
        <textarea
          rows={3}
          autoComplete="street-address"
          placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành"
          value={form.address}
          onChange={set('address')}
          className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm focus:border-blue-500 focus:outline-none"
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
