import { useMemo } from 'react'
import { useAsync } from '../../hooks/useAsync'
import { loadAdminUnits } from './adminUnits'
import { provincesOf, wardsOf } from './address'
import UnitCombobox from './UnitCombobox'

const inputClass =
  'h-11 w-full rounded-lg border bg-surface px-3 text-sm focus:border-blue-500 focus:outline-none'

// Các ô của một địa chỉ (sổ địa chỉ và trang thanh toán): người nhận, SĐT, Tỉnh/Thành, Phường/Xã,
// số nhà và đường. Không có Quận/Huyện (mô hình 2 cấp). form/errors theo validateAddress.
// onChange(patch): gộp vào form ở component cha. idPrefix: tránh trùng id khi có 2 form một trang.
export default function AddressFields({ form, errors = {}, onChange, idPrefix = 'dia-chi' }) {
  const units = useAsync(loadAdminUnits, [])
  // Giữ nguyên mảng giữa các lần render để suggestUnits dùng lại chỉ mục đã chuẩn hóa.
  const provinces = useMemo(() => provincesOf(units.data), [units.data])
  const wards = units.data && form.province ? wardsOf(units.data, form.province[0]) : []

  const text = (key) => (e) => onChange({ [key]: e.target.value })
  const ready = Boolean(units.data)

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Họ tên người nhận" error={errors.recipient_name}>
          <input
            className={`${inputClass} ${errors.recipient_name ? 'border-red-400' : 'border-slate-300'}`}
            autoComplete="name"
            maxLength={60}
            value={form.recipient_name}
            onChange={text('recipient_name')}
            aria-invalid={Boolean(errors.recipient_name)}
          />
        </Field>
        <Field label="Số điện thoại" error={errors.phone}>
          <input
            className={`${inputClass} ${errors.phone ? 'border-red-400' : 'border-slate-300'}`}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="0901234567"
            value={form.phone}
            onChange={text('phone')}
            aria-invalid={Boolean(errors.phone)}
          />
        </Field>
      </div>

      {units.error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {units.error.message}. Kiểm tra kết nối mạng rồi tải lại trang.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <UnitCombobox
          id={`${idPrefix}-tinh`}
          label="Tỉnh/Thành"
          units={provinces}
          value={form.province}
          // Đổi tỉnh → xóa phường/xã đã chọn (phường/xã thuộc tỉnh cũ).
          onChange={(province) =>
            onChange(province?.[0] === form.province?.[0] ? { province } : { province, ward: null })
          }
          disabled={!ready}
          placeholder={ready ? 'Gõ tên, vd: ho chi minh' : 'Đang tải danh sách…'}
          error={errors.province}
          notFoundMessage="Chọn Tỉnh/Thành trong danh sách gợi ý"
        />
        <UnitCombobox
          id={`${idPrefix}-xa`}
          label="Phường/Xã"
          units={wards}
          value={form.ward}
          onChange={(ward) => onChange({ ward })}
          disabled={!ready || !form.province}
          placeholder={form.province ? 'Gõ tên, vd: ben thanh' : 'Chọn Tỉnh/Thành trước'}
          error={errors.ward}
          notFoundMessage="Chọn Phường/Xã trong danh sách gợi ý"
        />
      </div>

      <Field label="Số nhà và đường" error={errors.street}>
        <input
          className={`${inputClass} ${errors.street ? 'border-red-400' : 'border-slate-300'}`}
          autoComplete="address-line1"
          placeholder="Vd: 227 Nguyễn Văn Cừ"
          maxLength={200}
          value={form.street}
          onChange={text('street')}
          aria-invalid={Boolean(errors.street)}
        />
      </Field>
    </div>
  )
}

function Field({ label, error, children }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      {children}
      {error && <span className="mt-1 block text-sm text-red-600 dark:text-red-400">{error}</span>}
    </label>
  )
}
