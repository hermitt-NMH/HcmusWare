import { formatPrice } from '../../lib/format'
import { BUILDER_SLOTS } from './builder'

const labelOf = (slug) => BUILDER_SLOTS.find((s) => s.slug === slug)?.label ?? slug

// Khung tổng kết: tổng tiền, công suất, lỗi/cảnh báo, nút thêm cả cấu hình vào giỏ.
// Bên phải bảng (máy tính) hoặc ở bước cuối (điện thoại).
export default function BuildSummary({
  build,
  result,
  totalPrice,
  stockIssues,
  onAddToCart,
  onReset,
  children, // phần thêm dưới nút (vd khung lưu cấu hình)
}) {
  const { errors, warnings, totalPowerW, recommendedPsuW, complete } = result
  const selectedCount = BUILDER_SLOTS.filter((s) => build[s.slug]).length
  const needVga = build.cpu?.specs?.igpu === false
  const missing = BUILDER_SLOTS.filter(
    (s) => !build[s.slug] && (!s.optional || (s.slug === 'vga' && needVga)),
  ).map((s) => s.label)

  const canAdd = complete && !errors.length && !stockIssues.length
  const reason = !complete
    ? `Còn thiếu: ${missing.join(', ')}`
    : errors.length
      ? 'Sửa hết lỗi tương thích để thêm vào giỏ'
      : stockIssues.length
        ? `Không đủ hàng: ${stockIssues.map(labelOf).join(', ')}`
        : null

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-slate-600">Tổng cộng</span>
        <span className="text-2xl font-bold text-red-600">{formatPrice(totalPrice)}</span>
      </div>

      {selectedCount > 0 && (
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-lg bg-slate-50 p-2">
            <dt className="text-xs text-slate-500">Công suất ước tính</dt>
            <dd className="font-semibold">~{totalPowerW} W</dd>
          </div>
          <div className="rounded-lg bg-slate-50 p-2">
            <dt className="text-xs text-slate-500">Nguồn đề xuất</dt>
            <dd className="font-semibold">≥ {recommendedPsuW} W</dd>
          </div>
        </dl>
      )}

      <div aria-live="polite" className="space-y-2">
        {selectedCount === 0 ? (
          <p className="text-sm text-slate-500">
            Bắt đầu bằng CPU: web sẽ chỉ hiện mainboard, tản nhiệt hợp với CPU đó.
          </p>
        ) : (
          <>
            {errors.length === 0 && (
              <p className="rounded-lg bg-green-50 p-3 text-sm font-medium text-green-800">
                ✓ {complete ? 'Cấu hình tương thích' : 'Các linh kiện đã chọn tương thích'}
              </p>
            )}
            {errors.length > 0 && (
              <IssueList
                title={`${errors.length} lỗi tương thích`}
                items={errors}
                className="border-red-200 bg-red-50 text-red-800"
              />
            )}
            {warnings.length > 0 && (
              <IssueList
                title={`${warnings.length} cảnh báo`}
                items={warnings}
                className="border-amber-200 bg-amber-50 text-amber-900"
              />
            )}
          </>
        )}
      </div>

      <div className="space-y-2">
        <button
          type="button"
          disabled={!canAdd}
          onClick={onAddToCart}
          className="h-12 w-full rounded-lg bg-blue-600 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-600 disabled:opacity-50"
        >
          Thêm cấu hình vào giỏ
        </button>
        {reason && selectedCount > 0 && (
          <p className="text-center text-xs text-slate-500">{reason}</p>
        )}
        {children}
        {selectedCount > 0 && (
          <button
            type="button"
            onClick={onReset}
            className="flex min-h-11 w-full items-center justify-center text-sm text-slate-500 hover:text-red-600"
          >
            Làm lại từ đầu
          </button>
        )}
      </div>
    </div>
  )
}

function IssueList({ title, items, className }) {
  return (
    <div className={`rounded-lg border p-3 text-sm ${className}`}>
      <p className="font-semibold">{title}</p>
      <ul className="mt-1 list-disc space-y-1 pl-5">
        {items.map((it, i) => (
          <li key={`${it.rule}-${i}`}>{it.message}</li>
        ))}
      </ul>
    </div>
  )
}
