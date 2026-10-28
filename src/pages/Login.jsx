import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { authErrorMessage } from '../lib/authErrors'
import { safeNext } from '../lib/safeNext'

const inputClass =
  'h-11 w-full rounded-lg border border-slate-300 bg-surface px-3 text-sm focus:border-blue-500 focus:outline-none'

function Field({ label, ...props }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      <input className={inputClass} {...props} />
    </label>
  )
}

// mode = 'login' (/dang-nhap) hoặc 'register' (/dang-ky).
export default function Login({ mode = 'login' }) {
  const isRegister = mode === 'register'
  const { user, loading, signIn, signUp, signInWithGoogle } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const next = safeNext(searchParams.get('next'))

  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [info, setInfo] = useState('') // vd "đã gửi email xác nhận"
  const [submitting, setSubmitting] = useState(false)

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  // Đã đăng nhập rồi thì không cần ở trang này nữa.
  if (!loading && user) return <Navigate to={next} replace />

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setInfo('')

    if (isRegister) {
      if (form.fullName.trim().length < 2) return setError('Vui lòng nhập họ tên.')
      if (form.password.length < 6) return setError('Mật khẩu cần ít nhất 6 ký tự.')
      if (form.password !== form.confirm) return setError('Mật khẩu nhập lại không khớp.')
    }

    setSubmitting(true)
    try {
      const email = form.email.trim()
      if (isRegister) {
        const { data, error } = await signUp(email, form.password, form.fullName.trim())
        if (error) return setError(authErrorMessage(error))
        // Supabase bật "xác nhận email": chưa có phiên đăng nhập, phải mở mail trước.
        // identities rỗng nghĩa là email đã có người đăng ký (Supabase không báo lỗi để tránh dò email).
        if (!data.session) {
          if (data.user?.identities?.length === 0)
            return setError('Email này đã được đăng ký. Hãy đăng nhập.')
          return setInfo(
            `Đã gửi email xác nhận tới ${email}. Hãy mở hộp thư và bấm link để hoàn tất đăng ký.`,
          )
        }
      } else {
        const { error } = await signIn(email, form.password)
        if (error) return setError(authErrorMessage(error))
      }
      navigate(next, { replace: true })
    } finally {
      setSubmitting(false)
    }
  }

  const handleGoogle = async () => {
    setError('')
    const { error } = await signInWithGoogle(next)
    // Thành công thì trình duyệt đã chuyển sang Google, chỉ cần xử lý khi lỗi.
    if (error) setError(authErrorMessage(error))
  }

  // Giữ tham số next khi chuyển qua lại giữa đăng nhập và đăng ký.
  const switchTo = `${isRegister ? '/dang-nhap' : '/dang-ky'}${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-2xl border border-slate-200 bg-surface p-5 shadow-sm sm:p-8">
        <h1 className="text-2xl font-bold">{isRegister ? 'Tạo tài khoản' : 'Đăng nhập'}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {isRegister
            ? 'Lưu cấu hình, theo dõi giá và đặt hàng nhanh hơn.'
            : 'Chào mừng bạn quay lại HcmusWare.'}
        </p>

        <button
          type="button"
          onClick={handleGoogle}
          className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-surface text-sm font-medium hover:bg-slate-50"
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path
              fill="#FFC107"
              d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
            />
            <path
              fill="#FF3D00"
              d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
            />
            <path
              fill="#4CAF50"
              d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
            />
            <path
              fill="#1976D2"
              d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
            />
          </svg>
          Tiếp tục với Google
        </button>

        <div className="my-5 flex items-center gap-3 text-xs text-slate-500">
          <span className="h-px flex-1 bg-slate-200" />
          hoặc dùng email
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <Field
              label="Họ và tên"
              autoComplete="name"
              required
              value={form.fullName}
              onChange={set('fullName')}
            />
          )}
          <Field
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={set('email')}
          />
          <Field
            label="Mật khẩu"
            type="password"
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            required
            minLength={isRegister ? 6 : undefined}
            value={form.password}
            onChange={set('password')}
          />
          {isRegister && (
            <Field
              label="Nhập lại mật khẩu"
              type="password"
              autoComplete="new-password"
              required
              value={form.confirm}
              onChange={set('confirm')}
            />
          )}

          {/* role="alert": trình đọc màn hình đọc ngay khi có lỗi */}
          {error && (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}
          {info && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{info}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="h-11 w-full rounded-lg bg-blue-600 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {submitting ? 'Đang xử lý…' : isRegister ? 'Đăng ký' : 'Đăng nhập'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-600">
          {isRegister ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'}{' '}
          <Link
            to={switchTo}
            className="inline-flex min-h-11 items-center font-medium text-blue-700 dark:text-blue-300 hover:underline"
          >
            {isRegister ? 'Đăng nhập' : 'Đăng ký ngay'}
          </Link>
        </p>
      </div>
    </div>
  )
}
