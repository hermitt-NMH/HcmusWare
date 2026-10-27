import { useState } from 'react'
import { useAsync } from '../../hooks/useAsync'
import { useAuth } from '../../hooks/useAuth'
import { getAdminUsers, setUserRole } from '../../lib/api'
import { formatDate } from '../../lib/format'
import { ROLE_VALUES, roleLabel } from '../../lib/roles'

const SHOP_STATUS = { pending: 'chờ duyệt', active: 'đang hoạt động', locked: 'bị khóa' }

// Quản lý người dùng: tìm theo email / tên, đổi vai trò (khách hàng, người bán, admin).
// DB chặn người không phải admin và chặn admin tự đổi vai trò của mình (hàm set_user_role).
export default function AdminUsers() {
  const [input, setInput] = useState('')
  const [search, setSearch] = useState('')
  const users = useAsync(() => getAdminUsers(search), [search])
  const [changed, setChanged] = useState({}) // id → vai trò mới (khỏi tải lại cả danh sách)

  const submit = (e) => {
    e.preventDefault()
    setChanged({})
    setSearch(input.trim())
  }

  return (
    <div className="space-y-3">
      <form role="search" onSubmit={submit} className="flex gap-2">
        <input
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Tìm theo email hoặc họ tên…"
          aria-label="Tìm người dùng"
          className="h-11 min-w-0 flex-1 rounded-lg border border-slate-300 bg-surface px-3 text-sm focus:border-blue-500 focus:outline-none"
        />
        <button
          type="submit"
          className="h-11 shrink-0 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Tìm
        </button>
      </form>

      {users.loading && <p className="py-8 text-center text-slate-500">Đang tải người dùng…</p>}
      {users.error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          Không tải được: {users.error.message}
        </p>
      )}
      {users.data && !users.data.length && (
        <p className="py-8 text-center text-sm text-slate-500">Không tìm thấy người dùng nào.</p>
      )}
      {users.data?.length === 100 && (
        <p className="text-xs text-slate-500">
          Đang hiện 100 người mới nhất, gõ email để tìm thêm.
        </p>
      )}

      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-surface">
        {users.data?.map((u) => (
          <UserRow
            key={u.id}
            user={{ ...u, role: changed[u.id] ?? u.role }}
            onChanged={(role) => setChanged((c) => ({ ...c, [u.id]: role }))}
          />
        ))}
      </ul>
    </div>
  )
}

function UserRow({ user: u, onChanged }) {
  const { user: me } = useAuth()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const isMe = u.id === me?.id

  const change = async (role) => {
    if (role === u.role) return
    const who = u.full_name || u.email
    if (!window.confirm(`Đổi vai trò của ${who} thành "${roleLabel(role)}"?`)) return
    setSaving(true)
    setError('')
    try {
      await setUserRole(u.id, role)
      onChanged(role)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <li className="flex flex-col gap-2 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate font-medium">
          {u.full_name || '(chưa có tên)'}
          {isMe && <span className="ml-1 text-xs font-normal text-slate-500">(bạn)</span>}
        </p>
        <p className="truncate text-slate-500">{u.email}</p>
        <p className="text-xs text-slate-500">
          Tham gia {formatDate(u.created_at)}
          {u.shop_name &&
            ` · Shop "${u.shop_name}" (${SHOP_STATUS[u.shop_status] ?? u.shop_status})`}
        </p>
        {error && (
          <p role="alert" className="mt-1 text-xs text-red-700">
            {error}
          </p>
        )}
      </div>
      <label className="flex shrink-0 items-center gap-2">
        <span className="text-slate-500 sm:sr-only">Vai trò</span>
        <select
          value={u.role}
          onChange={(e) => change(e.target.value)}
          disabled={saving || isMe}
          title={isMe ? 'Không thể tự đổi vai trò của chính mình' : undefined}
          aria-label={`Vai trò của ${u.email}`}
          className="h-11 rounded-lg border border-slate-300 bg-surface px-3 disabled:opacity-60"
        >
          {ROLE_VALUES.map((r) => (
            <option key={r} value={r}>
              {roleLabel(r)}
            </option>
          ))}
        </select>
      </label>
    </li>
  )
}
