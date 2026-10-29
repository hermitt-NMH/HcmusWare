import { useMemo, useState } from 'react'
import { suggestUnits } from './address'

// Ô gõ có gợi ý cho Tỉnh/Thành hoặc Phường/Xã (US-17.2). Phải chọn từ gợi ý: gõ tên không có
// trong danh sách thì value vẫn null và hiện notFoundMessage khi rời ô.
// Bàn phím: ↑ ↓ di chuyển, Enter chọn, Esc đóng (mẫu combobox của WAI-ARIA).
// units: [[mã, tên], ...]; value: [mã, tên] | null; onChange(value | null).
export default function UnitCombobox({
  id,
  label,
  units,
  value,
  onChange,
  disabled = false,
  placeholder,
  error,
  notFoundMessage,
}) {
  const [text, setText] = useState(value?.[1] ?? '')
  // value đổi từ ngoài (đổi tỉnh → xóa phường/xã, mở form sửa) thì chữ trong ô đổi theo.
  // Cập nhật state ngay khi render theo hướng dẫn của React (như Checkout.jsx).
  const [synced, setSynced] = useState(value)
  if (value !== synced) {
    setSynced(value)
    setText(value?.[1] ?? '')
  }
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [left, setLeft] = useState(false) // đã rời ô ít nhất một lần

  const options = useMemo(() => (open ? suggestUnits(units, text) : []), [open, units, text])
  const listId = `${id}-goi-y`
  const optionId = (i) => `${id}-goi-y-${i}`

  const choose = (unit) => {
    setSynced(unit)
    setText(unit[1])
    setOpen(false)
    onChange(unit)
  }

  const handleInput = (e) => {
    setText(e.target.value)
    setOpen(true)
    setActive(0)
    // Sửa chữ sau khi đã chọn → bỏ lựa chọn cũ (giữ chữ đang gõ: đặt synced trước khi báo ra ngoài).
    if (value) {
      setSynced(null)
      onChange(null)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) setOpen(true)
      else setActive((i) => Math.min(i + 1, options.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      // Enter khi đang mở gợi ý = chọn, không gửi form.
      if (open && options[active]) {
        e.preventDefault()
        choose(options[active])
      }
    } else if (e.key === 'Escape' && open) {
      e.preventDefault()
      setOpen(false)
    }
  }

  const hint = !error && left && !open && text.trim() && !value ? notFoundMessage : ''
  const shownError = error || hint
  const showList = open && text.trim() !== ''

  return (
    <div className="block text-sm">
      <label htmlFor={id} className="mb-1 block font-medium text-slate-700">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && options[active] ? optionId(active) : undefined}
          aria-invalid={Boolean(shownError)}
          autoComplete="off"
          disabled={disabled}
          placeholder={placeholder}
          value={text}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={() => text.trim() && !value && setOpen(true)}
          onBlur={() => {
            setOpen(false)
            setLeft(true)
          }}
          className={`h-11 w-full rounded-lg border bg-surface px-3 text-sm focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100 ${shownError ? 'border-red-400' : 'border-slate-300'}`}
        />
        {showList && (
          <ul
            id={listId}
            role="listbox"
            aria-label={label}
            className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-slate-200 bg-surface py-1 shadow-lg"
          >
            {options.length ? (
              options.map((unit, i) => (
                <li
                  key={unit[0]}
                  id={optionId(i)}
                  role="option"
                  aria-selected={i === active}
                  // mousedown thay cho click: chọn trước khi ô mất focus (onBlur đóng danh sách).
                  onMouseDown={(e) => {
                    e.preventDefault()
                    choose(unit)
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={`flex min-h-11 cursor-pointer items-center px-3 ${i === active ? 'bg-blue-50 text-blue-800' : ''}`}
                >
                  {unit[1]}
                </li>
              ))
            ) : (
              <li
                role="option"
                aria-selected="false"
                aria-disabled="true"
                className="px-3 py-2 text-slate-500"
              >
                Không có gợi ý phù hợp
              </li>
            )}
          </ul>
        )}
      </div>
      {shownError && (
        <span className="mt-1 block text-sm text-red-600 dark:text-red-400">{shownError}</span>
      )}
    </div>
  )
}
