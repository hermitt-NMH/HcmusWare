import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { unsubscribeEmail } from '../lib/api'

const KINDS = { gia: 'email cảnh báo giá', don: 'email trạng thái đơn hàng' }

// /tat-email?t=<email_token>&loai=gia|don – link cuối mỗi email (F12 – US-12.3), không cần đăng nhập.
// Phải bấm nút mới tắt: trình quét link của hộp thư tự mở link sẽ không tắt nhầm.
export default function Unsubscribe() {
  const [params] = useSearchParams()
  const token = params.get('t') ?? ''
  const kind = params.get('loai') ?? ''
  const [state, setState] = useState('idle') // idle | saving | done | invalid | error
  const valid = KINDS[kind] && /^[0-9a-f-]{36}$/i.test(token)

  const submit = async () => {
    setState('saving')
    try {
      setState((await unsubscribeEmail(token, kind)) ? 'done' : 'invalid')
    } catch {
      setState('error')
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4 rounded-2xl border border-slate-200 bg-surface p-6 text-center">
      <h1 className="text-xl font-bold">Tắt email thông báo</h1>
      {!valid || state === 'invalid' ? (
        <p className="text-sm text-slate-600">
          Link không hợp lệ hoặc đã cũ. Bạn có thể bật/tắt email trong trang tài khoản.
        </p>
      ) : state === 'done' ? (
        <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
          Đã tắt {KINDS[kind]}. Thông báo trên chuông trong web vẫn hiện như cũ.
        </p>
      ) : (
        <>
          <p className="text-sm text-slate-600">
            Bạn sẽ không nhận {KINDS[kind]} từ HcmusWare nữa. Có thể bật lại trong trang tài khoản.
          </p>
          {state === 'error' && (
            <p className="text-sm text-red-600 dark:text-red-400">Không tắt được, thử lại sau.</p>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={state === 'saving'}
            className="inline-flex h-11 items-center rounded-lg bg-blue-600 px-5 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {state === 'saving' ? 'Đang tắt…' : `Tắt ${KINDS[kind]}`}
          </button>
        </>
      )}
      <Link
        to="/tai-khoan#email"
        className="block text-sm text-blue-700 hover:underline dark:text-blue-300"
      >
        Cài đặt email trong tài khoản
      </Link>
    </div>
  )
}
