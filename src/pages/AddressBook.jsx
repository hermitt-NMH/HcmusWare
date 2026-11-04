import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAsync } from '../hooks/useAsync'
import { deleteAddress, getMyAddresses, saveAddress, setDefaultAddress } from '../lib/api'
import AddressFields from '../features/address/AddressFields'
import {
  MAX_ADDRESSES,
  addressToForm,
  formatAddress,
  validateAddress,
} from '../features/address/address'
import { t } from '../lib/i18n'

// Sổ địa chỉ /tai-khoan/dia-chi (US-17.1): thêm, sửa, xóa, đặt mặc định; tối đa 10 địa chỉ.
// Đăng nhập do RoleRoute trong App.jsx kiểm tra. Quy tắc mặc định / giới hạn nằm ở trigger trong DB.
export default function AddressBook() {
  const [reload, setReload] = useState(0)
  const list = useAsync(getMyAddresses, [reload])
  const [editing, setEditing] = useState(null) // null | 'new' | id địa chỉ đang sửa
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const addresses = list.data ?? []
  const full = addresses.length >= MAX_ADDRESSES
  const refresh = (message = '') => {
    setNotice(message)
    setEditing(null)
    setReload((n) => n + 1)
  }

  const run = async (action, message) => {
    setBusy(true)
    setError('')
    try {
      await action()
      refresh(message)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">{t('Sổ địa chỉ')}</h1>
          <p className="text-sm text-slate-500">
            {t('{n}/{max} địa chỉ · địa chỉ mặc định được điền sẵn khi thanh toán', {
              n: addresses.length,
              max: MAX_ADDRESSES,
            })}
          </p>
        </div>
        <Link
          to="/tai-khoan"
          className="inline-flex min-h-11 items-center text-sm text-blue-700 hover:underline dark:text-blue-300"
        >
          {t('← Tài khoản')}
        </Link>
      </div>

      {notice && (
        <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {list.loading && (
        <p className="py-8 text-center text-slate-500">{t('Đang tải sổ địa chỉ…')}</p>
      )}
      {list.error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {t('Không tải được sổ địa chỉ: {msg}', { msg: t(list.error.message) })}
        </p>
      )}

      {editing === 'new' ? (
        <AddressEditor
          title={t('Thêm địa chỉ')}
          canChooseDefault={addresses.length > 0}
          onCancel={() => setEditing(null)}
          onSaved={() => refresh(t('Đã thêm địa chỉ.'))}
        />
      ) : (
        list.data && (
          <button
            type="button"
            onClick={() => {
              setEditing('new')
              setNotice('')
            }}
            disabled={full || editing !== null}
            className="h-11 w-full rounded-lg border border-dashed border-slate-300 bg-surface text-sm font-medium text-blue-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-blue-300"
          >
            {full
              ? t('Đã đủ {max} địa chỉ, xóa bớt để thêm mới', { max: MAX_ADDRESSES })
              : t('+ Thêm địa chỉ')}
          </button>
        )
      )}

      {list.data && !addresses.length && editing !== 'new' && (
        <p className="rounded-xl border border-slate-200 bg-surface p-5 text-center text-sm text-slate-500">
          {t('Sổ địa chỉ đang trống. Địa chỉ đầu tiên bạn thêm sẽ là địa chỉ mặc định.')}
        </p>
      )}

      <ul className="space-y-3">
        {addresses.map((a) =>
          editing === a.id ? (
            <li key={a.id}>
              <AddressEditor
                title={t('Sửa địa chỉ')}
                address={a}
                onCancel={() => setEditing(null)}
                onSaved={() => refresh(t('Đã lưu địa chỉ.'))}
              />
            </li>
          ) : (
            <li
              key={a.id}
              className={`rounded-xl border bg-surface p-4 text-sm ${a.is_default ? 'border-blue-300' : 'border-slate-200'}`}
            >
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{a.recipient_name}</span>
                <span className="text-slate-500">{a.phone}</span>
                {a.is_default && (
                  <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
                    {t('Mặc định')}
                  </span>
                )}
              </p>
              <p className="mt-1 text-slate-600">{formatAddress(a)}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                <ActionButton
                  disabled={busy || editing !== null}
                  onClick={() => {
                    setEditing(a.id)
                    setNotice('')
                  }}
                >
                  {t('Sửa')}
                </ActionButton>
                {!a.is_default && (
                  <ActionButton
                    disabled={busy || editing !== null}
                    onClick={() =>
                      run(() => setDefaultAddress(a.id), t('Đã đổi địa chỉ mặc định.'))
                    }
                  >
                    {t('Đặt làm mặc định')}
                  </ActionButton>
                )}
                <ActionButton
                  danger
                  disabled={busy || editing !== null}
                  onClick={() => {
                    if (!window.confirm(t('Xóa địa chỉ "{addr}"?', { addr: formatAddress(a) })))
                      return
                    run(
                      () => deleteAddress(a.id),
                      a.is_default && addresses.length > 1
                        ? t('Đã xóa. Địa chỉ thêm gần nhất được đặt làm mặc định.')
                        : t('Đã xóa địa chỉ.'),
                    )
                  }}
                >
                  {t('Xóa')}
                </ActionButton>
              </div>
            </li>
          ),
        )}
      </ul>
    </div>
  )
}

function ActionButton({ danger = false, ...props }) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex h-10 items-center rounded-lg px-3 disabled:opacity-50 ${
        danger
          ? 'text-red-600 hover:bg-red-50 dark:text-red-400'
          : 'text-blue-700 hover:bg-blue-50 dark:text-blue-300'
      }`}
    />
  )
}

// Form thêm / sửa một địa chỉ. canChooseDefault: sổ đã có địa chỉ (địa chỉ đầu tiên luôn mặc định).
function AddressEditor({ title, address, canChooseDefault = false, onCancel, onSaved }) {
  const [form, setForm] = useState(() => addressToForm(address))
  const [makeDefault, setMakeDefault] = useState(false)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const handleChange = (patch) => {
    setForm((f) => ({ ...f, ...patch }))
    setErrors((e) => ({
      ...e,
      ...Object.fromEntries(Object.keys(patch).map((k) => [k, undefined])),
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const { data, errors: found } = validateAddress(form)
    setErrors(found)
    setSubmitError('')
    if (Object.keys(found).length) return
    setSaving(true)
    try {
      await saveAddress(address?.id ?? null, makeDefault ? { ...data, is_default: true } : data)
      onSaved()
    } catch (err) {
      setSubmitError(err.message)
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="space-y-4 rounded-xl border border-blue-300 bg-surface p-4 sm:p-5"
    >
      <h2 className="text-lg font-semibold">{title}</h2>
      <AddressFields
        form={form}
        errors={errors}
        onChange={handleChange}
        idPrefix={`dia-chi-${address?.id ?? 'moi'}`}
      />
      {canChooseDefault && (
        <label className="flex min-h-11 items-center gap-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={makeDefault}
            onChange={(e) => setMakeDefault(e.target.checked)}
            className="h-5 w-5 accent-blue-600"
          />
          {t('Đặt làm địa chỉ mặc định')}
        </label>
      )}
      {submitError && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {submitError}
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="h-11 rounded-lg border border-slate-300 bg-surface px-5 text-sm font-medium hover:bg-slate-50"
        >
          {t('Hủy')}
        </button>
        <button
          type="submit"
          disabled={saving}
          className="h-11 rounded-lg bg-blue-600 px-6 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? t('Đang lưu…') : t('Lưu địa chỉ')}
        </button>
      </div>
    </form>
  )
}
