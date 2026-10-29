import { useState } from 'react'
import { useAsync } from '../../hooks/useAsync'
import { getEmailPrefs, setEmailPref } from '../../lib/api'

const OPTIONS = [
  {
    field: 'email_price_alerts',
    label: 'Cảnh báo giá',
    hint: 'Khi giá sản phẩm xuống tới giá mong muốn bạn đã đặt.',
  },
  {
    field: 'email_order_status',
    label: 'Trạng thái đơn hàng',
    hint: 'Khi đơn chuyển sang Đang giao, Hoàn tất hoặc Đã hủy.',
  },
]

// Mục "Email thông báo" trong /tai-khoan (F12 – US-12.3). Mặc định bật cả 2 loại.
// Thông báo trong web (chuông) vẫn hiện dù tắt email.
export default function EmailPrefs({ userId, email }) {
  const prefs = useAsync(() => getEmailPrefs(userId), [userId])
  const [changed, setChanged] = useState({})
  const [saving, setSaving] = useState('')
  const [error, setError] = useState('')

  const value = (field) => changed[field] ?? prefs.data?.[field] ?? true

  const toggle = async (field) => {
    const next = !value(field)
    setError('')
    setSaving(field)
    setChanged((c) => ({ ...c, [field]: next }))
    try {
      await setEmailPref(userId, field, next)
    } catch (err) {
      setChanged((c) => ({ ...c, [field]: !next }))
      setError(`Không lưu được: ${err.message}`)
    } finally {
      setSaving('')
    }
  }

  return (
    <section
      id="email"
      className="scroll-mt-36 space-y-3 rounded-2xl border border-slate-200 bg-surface p-5 sm:p-6"
    >
      <div>
        <h2 className="text-lg font-semibold">Email thông báo</h2>
        <p className="text-sm break-words text-slate-500">
          Gửi tới {email}. Thông báo trên chuông vẫn hiện dù bạn tắt email.
        </p>
      </div>
      {prefs.error && (
        <p className="text-sm text-red-600 dark:text-red-400">
          Không tải được: {prefs.error.message}
        </p>
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <ul className="divide-y divide-slate-100">
        {OPTIONS.map((o) => (
          <li key={o.field}>
            <label className="flex min-h-14 cursor-pointer items-center gap-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{o.label}</span>
                <span className="block text-xs text-slate-500">{o.hint}</span>
              </span>
              <input
                type="checkbox"
                role="switch"
                className="h-5 w-5 shrink-0 accent-blue-600"
                checked={value(o.field)}
                disabled={prefs.loading || !!prefs.error || saving === o.field}
                onChange={() => toggle(o.field)}
              />
            </label>
          </li>
        ))}
      </ul>
    </section>
  )
}
