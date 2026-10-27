import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { saveBuild } from '../../lib/api'
import { serializeBuild, shareUrl, suggestBuildName } from './builder'
import CopyLinkButton from './CopyLinkButton'

// Lưu cấu hình đang build vào tài khoản và lấy link chia sẻ.
// Chưa đăng nhập: dẫn sang đăng nhập rồi quay lại (cấu hình vẫn nằm trong localStorage).
export default function SaveBuild({ build, ids, ramQty }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(null) // dòng saved_builds vừa lưu

  if (!Object.keys(ids).length) return null

  if (!user) {
    return (
      <p className="text-center text-xs text-slate-500">
        <Link
          to="/dang-nhap?next=%2Fbuild-pc"
          className="font-medium text-blue-700 dark:text-blue-300 hover:underline"
        >
          Đăng nhập
        </Link>{' '}
        để lưu cấu hình và chia sẻ bằng link.
      </p>
    )
  }

  if (saved) {
    return (
      <div className="space-y-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm">
        <p className="font-medium text-green-800">✓ Đã lưu "{saved.name}"</p>
        <input
          readOnly
          value={shareUrl(saved.share_code)}
          onFocus={(e) => e.target.select()}
          aria-label="Link chia sẻ"
          className="h-10 w-full rounded-md border border-green-200 bg-surface px-2 text-xs"
        />
        <div className="flex flex-wrap gap-2">
          <CopyLinkButton url={shareUrl(saved.share_code)} className="bg-surface" />
          <Link
            to="/tai-khoan#cau-hinh"
            className="inline-flex h-10 items-center px-2 text-sm text-blue-700 dark:text-blue-300 hover:underline"
          >
            Xem cấu hình đã lưu
          </Link>
        </div>
        <button
          type="button"
          onClick={() => {
            setSaved(null)
            setOpen(false)
          }}
          className="text-xs text-slate-500 hover:underline"
        >
          Lưu thêm bản khác
        </button>
      </div>
    )
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setName(suggestBuildName(build))
          setOpen(true)
        }}
        className="h-11 w-full rounded-lg border border-blue-600 font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-50"
      >
        Lưu cấu hình & chia sẻ
      </button>
    )
  }

  const submit = async (e) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return setError('Vui lòng đặt tên cho cấu hình.')
    setSaving(true)
    setError('')
    try {
      setSaved(await saveBuild(user.id, trimmed, JSON.parse(serializeBuild(ids, ramQty))))
    } catch (err) {
      setError(`Không lưu được: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2 rounded-lg border border-slate-200 p-3">
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Tên cấu hình</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          autoFocus
          className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-blue-500 focus:outline-none"
        />
      </label>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="h-11 flex-1 rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? 'Đang lưu…' : 'Lưu'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="h-11 rounded-lg px-3 text-sm text-slate-500 hover:bg-slate-100"
        >
          Hủy
        </button>
      </div>
    </form>
  )
}
