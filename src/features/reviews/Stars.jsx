// Sao đánh giá: Stars để hiện (chỉ đọc), StarInput để chọn 1–5 sao trong form.
// Sao là hình (không có số đi kèm) nên cần tương phản ≥ 3:1 với nền ở cả 2 chế độ (WCAG 1.4.11):
// sao đầy amber-600 (3,2:1 trên nền trắng, 5,4:1 trên nền tối; không đổi theo chế độ tối),
// sao rỗng slate-500 (4,8:1 / 6,9:1). amber-500 và slate-300 trước đây chỉ đạt 2,1:1 và 1,5:1.

export function Stars({ value, className = 'text-base' }) {
  const full = Math.round(Number(value) || 0)
  return (
    <span className={`whitespace-nowrap ${className}`} aria-label={`${value} trên 5 sao`}>
      <span aria-hidden="true" className="text-amber-600">
        {'★'.repeat(full)}
      </span>
      <span aria-hidden="true" className="text-slate-500">
        {'★'.repeat(5 - full)}
      </span>
    </span>
  )
}

// Nhóm radio (đọc được bằng trình đọc màn hình, chọn bằng phím mũi tên), mỗi sao là vùng bấm 44 px.
export function StarInput({ value, onChange, name = 'rating' }) {
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium">
        Số sao <span className="text-red-600 dark:text-red-400">*</span>
      </legend>
      <div className="flex">
        {[1, 2, 3, 4, 5].map((n) => (
          <label
            key={n}
            className={`flex h-11 w-11 cursor-pointer items-center justify-center text-3xl leading-none has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-blue-600 ${
              n <= value ? 'text-amber-600' : 'text-slate-500 hover:text-amber-600'
            }`}
          >
            <input
              type="radio"
              name={name}
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
              className="sr-only"
            />
            <span aria-hidden="true">★</span>
            <span className="sr-only">{n} sao</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
