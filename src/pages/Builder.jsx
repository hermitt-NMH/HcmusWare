import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { getBuildByShareCode, getProducts } from '../lib/api'
import { useAsync } from '../hooks/useAsync'
import { useCart } from '../hooks/useCart'
import { formatPrice } from '../lib/format'
import { categoryImage, thumbUrl } from '../lib/images'
import { specRows } from '../lib/specs'
import { checkCompatibility } from '../features/builder/compatibility'
import {
  BUILDER_SLOTS,
  MAX_RAM_QTY,
  SHARE_PARAM,
  STORAGE_KEY,
  buildFromItems,
  buildToCartEntries,
  buildTotalPrice,
  filterCandidates,
  parseStoredBuild,
  partQty,
  resolveBuild,
  sameBuild,
  serializeBuild,
  stockProblems,
} from '../features/builder/builder'
import PartPicker from '../features/builder/PartPicker'
import BuildSummary from '../features/builder/BuildSummary'
import SaveBuild from '../features/builder/SaveBuild'

// Cấu hình đang build lưu trong localStorage (chỉ id) để tải lại trang không mất.
function loadBuild() {
  try {
    return parseStoredBuild(localStorage.getItem(STORAGE_KEY))
  } catch {
    return parseStoredBuild(null)
  }
}

// Trang Build PC: máy tính là bảng 8 dòng + khung tổng kết; điện thoại là từng bước.
// Mỗi lần chọn, compatibility.js chạy lại và báo lỗi/cảnh báo ngay.
export default function Builder() {
  const products = useAsync(() => getProducts())
  const [saved, setSaved] = useState(loadBuild)
  const { ids, ramQty } = saved
  const { addItems } = useCart()
  const navigate = useNavigate()
  const shared = useSharedBuild(saved, setSaved)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, serializeBuild(ids, ramQty))
    } catch {
      // Không lưu được (chế độ ẩn danh...) thì vẫn build bình thường trong phiên này.
    }
  }, [ids, ramQty])

  const all = products.data
  const build = useMemo(() => resolveBuild(ids, all ?? []), [ids, all])
  const result = useMemo(() => checkCompatibility({ ...build, ramQty }), [build, ramQty])
  const totalPrice = buildTotalPrice(build, ramQty)
  const stockIssues = stockProblems(build, ramQty)

  const select = (slug, product) =>
    setSaved((s) => ({ ...s, ids: { ...s.ids, [slug]: product.id } }))
  const remove = (slug) =>
    setSaved((s) => {
      const next = { ...s.ids }
      delete next[slug]
      return { ...s, ids: next }
    })
  const setRamQty = (qty) => setSaved((s) => ({ ...s, ramQty: qty }))
  const reset = () => {
    if (window.confirm('Bỏ hết linh kiện đã chọn?')) setSaved({ ids: {}, ramQty: 1 })
  }
  const addToCart = () => {
    addItems(buildToCartEntries(build, ramQty))
    navigate('/gio-hang')
  }

  // Trạng thái của từng dòng để tô màu: lỗi (đỏ) ưu tiên hơn cảnh báo (vàng).
  const statusOf = (slug) =>
    result.errors.some((e) => e.parts.includes(slug))
      ? 'error'
      : result.warnings.some((w) => w.parts.includes(slug))
        ? 'warning'
        : null

  // Tiêu đề hiện ngay cả khi đang tải để trang có nội dung sớm (LCP), không chờ dữ liệu.
  if (products.loading)
    return (
      <div className="space-y-4">
        <BuilderIntro />
        <BuilderSkeleton />
      </div>
    )
  if (products.error) {
    return (
      <div className="space-y-4">
        <BuilderIntro />
        <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
          Không tải được linh kiện: {products.error.message}
        </p>
      </div>
    )
  }

  const common = {
    all,
    build,
    ramQty,
    result,
    statusOf,
    onSelect: select,
    onRemove: remove,
    onRamQty: setRamQty,
  }
  const summary = (
    <BuildSummary
      build={build}
      result={result}
      totalPrice={totalPrice}
      stockIssues={stockIssues}
      onAddToCart={addToCart}
      onReset={reset}
    >
      <SaveBuild build={build} ids={ids} ramQty={ramQty} />
    </BuildSummary>
  )

  return (
    <div className="space-y-4">
      <BuilderIntro />

      {shared.notice && (
        <div
          role="status"
          className={`flex items-start justify-between gap-2 rounded-lg p-3 text-sm ${
            shared.notice.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-800'
          }`}
        >
          <span>{shared.notice.message}</span>
          <button
            type="button"
            onClick={shared.dismiss}
            aria-label="Đóng thông báo"
            className="-m-2 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md hover:bg-black/5"
          >
            ✕
          </button>
        </div>
      )}

      {/* Máy tính: bảng 8 dòng + tổng kết bên phải (từ 1280 px; nhỏ hơn thì nằm dưới bảng) */}
      <div className="hidden gap-4 md:grid xl:grid-cols-[1fr_320px] xl:items-start">
        <DesktopTable {...common} />
        <div className="xl:sticky xl:top-36">{summary}</div>
      </div>

      {/* Điện thoại: từng bước */}
      <div className="md:hidden">
        <MobileSteps key={shared.loadCount} {...common} totalPrice={totalPrice} summary={summary} />
      </div>
    </div>
  )
}

// Mở cấu hình từ link chia sẻ /build-pc?cau-hinh=<mã>: tải từ DB, thay cấu hình đang build
// (hỏi trước nếu đang có cấu hình khác), rồi bỏ tham số khỏi URL để tải lại trang không hỏi lại.
function useSharedBuild(current, setSaved) {
  const [params, setParams] = useSearchParams()
  const code = params.get(SHARE_PARAM)
  const [notice, setNotice] = useState(null)
  const [loadCount, setLoadCount] = useState(0) // tăng mỗi lần nạp → các bước điện thoại bắt đầu lại
  // Đọc cấu hình hiện tại qua ref để effect chỉ chạy lại khi đổi mã, không phải mỗi lần chọn linh kiện.
  const currentRef = useRef(current)
  currentRef.current = current

  useEffect(() => {
    if (!code) return
    let cancelled = false
    const clearParam = () =>
      setParams(
        (p) => {
          p.delete(SHARE_PARAM)
          return p
        },
        { replace: true },
      )

    getBuildByShareCode(code)
      .then((row) => {
        if (cancelled) return
        clearParam()
        if (!row) {
          setNotice({ type: 'error', message: 'Link chia sẻ không đúng hoặc cấu hình đã bị xóa.' })
          return
        }
        const next = buildFromItems(row.items)
        const cur = currentRef.current
        const hasCurrent = Object.keys(cur.ids).length > 0
        if (
          hasCurrent &&
          !sameBuild(cur, next) &&
          !window.confirm(`Thay cấu hình đang build bằng "${row.name}"?`)
        )
          return
        setSaved(next)
        setLoadCount((n) => n + 1)
        setNotice({
          type: 'info',
          message: `Đã mở cấu hình "${row.name}". Bạn có thể chỉnh sửa, thêm vào giỏ hoặc lưu thành bản của mình.`,
        })
      })
      .catch((err) => {
        if (cancelled) return
        clearParam()
        setNotice({ type: 'error', message: `Không mở được cấu hình: ${err.message}` })
      })
    return () => {
      cancelled = true
    }
  }, [code, setParams, setSaved])

  return { notice, loadCount, dismiss: () => setNotice(null) }
}

const ROW_STYLE = {
  error: 'bg-red-50/70',
  warning: 'bg-amber-50/70',
}
const BADGE = {
  error: (
    <span className="rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-semibold text-red-700">
      Lỗi
    </span>
  ),
  warning: (
    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800">
      Lưu ý
    </span>
  ),
}

function SlotLabel({ slot, build }) {
  const needVga = slot.slug === 'vga' && build.cpu?.specs?.igpu === false
  return (
    <span className="flex items-center gap-2">
      <img src={categoryImage(slot.slug)} alt="" className="h-7 w-7" />
      <span>
        <span className="block whitespace-nowrap font-medium">{slot.label}</span>
        {slot.optional && (
          <span
            className={`block text-[11px] ${needVga ? 'text-red-600 dark:text-red-400' : 'text-slate-500'}`}
          >
            {needVga ? 'Bắt buộc (CPU không có iGPU)' : 'Không bắt buộc'}
          </span>
        )}
      </span>
    </span>
  )
}

// Ảnh nhỏ + tên + vài thông số chính của linh kiện đã chọn.
function SelectedPart({ slug, product }) {
  const fallback = categoryImage(slug)
  const summary = specRows(slug, product.specs)
    .slice(0, 3)
    .map((r) => r.value)
    .join(' · ')
  return (
    <span className="flex min-w-0 items-center gap-3">
      <img
        src={thumbUrl(product.image_url) || fallback}
        alt=""
        onError={(e) => {
          if (!e.currentTarget.src.endsWith(fallback)) e.currentTarget.src = fallback
        }}
        className="h-12 w-12 shrink-0 rounded-md border border-slate-100 bg-surface object-contain"
      />
      <span className="min-w-0">
        <Link
          to={`/san-pham/${product.id}`}
          target="_blank"
          className="line-clamp-2 text-sm font-medium text-slate-900 hover:text-blue-700 dark:hover:text-blue-300"
        >
          {product.name}
        </Link>
        {summary && (
          <span title={summary} className="block truncate text-xs text-slate-500">
            {summary}
          </span>
        )}
        {product.stock <= 0 && (
          <span className="block text-xs font-medium text-red-600 dark:text-red-400">Hết hàng</span>
        )}
      </span>
    </span>
  )
}

function RamQtySelect({ value, onChange, id }) {
  return (
    <label htmlFor={id} className="inline-flex items-center gap-2 text-xs text-slate-500">
      Số kit
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-9 rounded-md border border-slate-300 bg-surface px-2 text-sm text-slate-900"
      >
        {Array.from({ length: MAX_RAM_QTY }, (_, i) => i + 1).map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </label>
  )
}

function DesktopTable({ all, build, ramQty, statusOf, onSelect, onRemove, onRamQty }) {
  const [picking, setPicking] = useState(null) // slug đang mở hộp thoại chọn
  const pickList = picking ? filterCandidates(picking, all, build) : null

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-surface">
        <table className="w-full table-fixed text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="w-44 px-4 py-3 font-medium">Linh kiện</th>
              <th className="px-4 py-3 font-medium">Đã chọn</th>
              <th className="w-32 px-4 py-3 text-right font-medium">Giá</th>
              <th className="w-36 px-4 py-3">
                <span className="sr-only">Thao tác</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {BUILDER_SLOTS.map((slot) => {
              const p = build[slot.slug]
              const status = statusOf(slot.slug)
              return (
                <tr
                  key={slot.slug}
                  className={`border-t border-slate-100 ${ROW_STYLE[status] ?? ''}`}
                >
                  <td className="px-4 py-3 align-middle">
                    <SlotLabel slot={slot} build={build} />
                  </td>
                  <td className="px-4 py-3">
                    {p ? (
                      <div className="space-y-1">
                        <SelectedPart slug={slot.slug} product={p} />
                        {slot.slug === 'ram' && (
                          <RamQtySelect id="ram-qty-desktop" value={ramQty} onChange={onRamQty} />
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-500">Chưa chọn</span>
                    )}
                    {status && <div className="mt-1">{BADGE[status]}</div>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-red-600 dark:text-red-400">
                    {p
                      ? formatPrice(p.price == null ? null : p.price * partQty(slot.slug, ramQty))
                      : ''}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setPicking(slot.slug)}
                        className={`inline-flex h-10 items-center rounded-lg px-3 text-sm font-medium ${
                          p
                            ? 'border border-slate-300 text-slate-700 hover:bg-slate-50'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        {p ? 'Đổi' : 'Chọn'}
                      </button>
                      {p && (
                        <button
                          type="button"
                          onClick={() => onRemove(slot.slug)}
                          aria-label={`Bỏ ${slot.label}`}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-red-600 dark:hover:text-red-400"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {picking && (
        <PickerDialog
          slot={BUILDER_SLOTS.find((s) => s.slug === picking)}
          onClose={() => setPicking(null)}
        >
          <PartPicker
            key={picking}
            slug={picking}
            candidates={pickList.items}
            filters={pickList.filters}
            build={build}
            ramQty={ramQty}
            selectedId={build[picking]?.id}
            onSelect={(product) => {
              onSelect(picking, product)
              setPicking(null)
            }}
          />
        </PickerDialog>
      )}
    </>
  )
}

// Hộp thoại dùng thẻ <dialog> của trình duyệt: Esc để đóng, focus nằm trong hộp thoại.
function PickerDialog({ slot, onClose, children }) {
  const ref = useRef(null)
  // Không gọi close() khi dọn dẹp: StrictMode chạy effect 2 lần, close() sẽ bắn sự kiện "close"
  // làm hộp thoại vừa mở đã tự đóng. Gỡ component thì thẻ <dialog> cũng biến mất theo.
  useEffect(() => {
    if (!ref.current.open) ref.current.showModal()
  }, [])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      // Bấm ra ngoài (vùng nền mờ) thì đóng.
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="picker-title"
      className="m-auto w-[min(720px,calc(100vw-2rem))] rounded-2xl p-0 backdrop:bg-gray-900/50"
    >
      <div className="flex max-h-[85vh] flex-col">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 id="picker-title" className="text-lg font-semibold">
            Chọn {slot.label}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </dialog>
  )
}

function MobileSteps({
  all,
  build,
  ramQty,
  result,
  statusOf,
  totalPrice,
  summary,
  onSelect,
  onRemove,
  onRamQty,
}) {
  // 0–7: 8 linh kiện; 8: tổng kết. Mở lại trang thì nhảy tới dòng đầu tiên chưa chọn.
  const [step, setStep] = useState(() => {
    const first = BUILDER_SLOTS.findIndex((s) => !build[s.slug] && !s.optional)
    return first === -1 ? BUILDER_SLOTS.length : first
  })
  const topRef = useRef(null)
  const lastStep = BUILDER_SLOTS.length

  const go = (n) => {
    setStep(Math.min(Math.max(n, 0), lastStep))
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const slot = BUILDER_SLOTS[step]
  const product = slot && build[slot.slug]
  const issues = slot
    ? [...result.errors, ...result.warnings].filter((x) => x.parts.includes(slot.slug))
    : []
  const { items, filters } = slot
    ? filterCandidates(slot.slug, all, build)
    : { items: [], filters: [] }

  return (
    <div ref={topRef} className="scroll-mt-32 space-y-4">
      {/* Thanh các bước, cuộn ngang */}
      <ol className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {BUILDER_SLOTS.map((s, i) => {
          const status = statusOf(s.slug)
          const done = Boolean(build[s.slug])
          return (
            <li key={s.slug} className="shrink-0">
              <button
                type="button"
                onClick={() => go(i)}
                aria-current={i === step ? 'step' : undefined}
                className={`inline-flex h-10 items-center gap-1 rounded-full border px-3 text-xs font-medium ${
                  i === step
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : status === 'error'
                      ? 'border-red-300 bg-red-50 text-red-700'
                      : done
                        ? 'border-green-300 bg-green-50 text-green-800'
                        : 'border-slate-300 bg-surface text-slate-600'
                }`}
              >
                {done && i !== step && (status === 'error' ? '!' : '✓')} {s.label}
              </button>
            </li>
          )
        })}
        <li className="shrink-0">
          <button
            type="button"
            onClick={() => go(lastStep)}
            aria-current={step === lastStep ? 'step' : undefined}
            className={`inline-flex h-10 items-center rounded-full border px-3 text-xs font-medium ${
              step === lastStep
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-slate-300 bg-surface text-slate-600'
            }`}
          >
            Tổng kết
          </button>
        </li>
      </ol>

      {slot ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold">
              Bước {step + 1}/{lastStep}: <SlotTitle slot={slot} build={build} />
            </h2>
          </div>

          {product && (
            <div className="space-y-2 rounded-xl border border-slate-200 bg-surface p-3">
              <div className="flex items-start justify-between gap-2">
                <SelectedPart slug={slot.slug} product={product} />
                <button
                  type="button"
                  onClick={() => onRemove(slot.slug)}
                  className="inline-flex h-11 shrink-0 items-center px-2 text-sm text-slate-500 hover:text-red-600 dark:hover:text-red-400"
                >
                  Bỏ chọn
                </button>
              </div>
              <div className="flex items-center justify-between">
                {slot.slug === 'ram' ? (
                  <RamQtySelect id="ram-qty-mobile" value={ramQty} onChange={onRamQty} />
                ) : (
                  <span />
                )}
                <span className="font-semibold text-red-600 dark:text-red-400">
                  {formatPrice(
                    product.price == null ? null : product.price * partQty(slot.slug, ramQty),
                  )}
                </span>
              </div>
            </div>
          )}

          {issues.length > 0 && (
            <ul className="space-y-1" aria-live="polite">
              {issues.map((x, i) => (
                <li
                  key={`${x.rule}-${i}`}
                  className={`rounded-lg p-2 text-sm ${
                    x.rule.startsWith('R') ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-900'
                  }`}
                >
                  {x.message}
                </li>
              ))}
            </ul>
          )}

          <PartPicker
            key={slot.slug}
            slug={slot.slug}
            candidates={items}
            filters={filters}
            build={build}
            ramQty={ramQty}
            selectedId={product?.id}
            onSelect={(p) => {
              onSelect(slot.slug, p)
              go(step + 1)
            }}
          />
        </section>
      ) : (
        <section className="space-y-3">
          <h2 className="text-base font-semibold">Tổng kết cấu hình</h2>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-surface">
            {BUILDER_SLOTS.map((s, i) => (
              <li key={s.slug}>
                <button
                  type="button"
                  onClick={() => go(i)}
                  className="flex min-h-12 w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm"
                >
                  <span className="shrink-0 text-slate-500">{s.label}</span>
                  <span
                    className={`truncate text-right ${
                      statusOf(s.slug) === 'error'
                        ? 'text-red-700'
                        : build[s.slug]
                          ? 'text-slate-900'
                          : 'text-slate-500'
                    }`}
                  >
                    {build[s.slug]?.name ?? 'Chưa chọn'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {summary}
        </section>
      )}

      {/* Thanh dưới: tổng tiền + nút lùi/tiếp, luôn thấy khi cuộn danh sách dài */}
      <div className="sticky bottom-0 -mx-4 flex items-center gap-2 border-t border-slate-200 bg-surface/95 px-4 py-2 backdrop-blur">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-slate-500">
            Tổng cộng
            {result.errors.length > 0 && (
              <span className="ml-1 font-semibold text-red-600 dark:text-red-400">
                · {result.errors.length} lỗi
              </span>
            )}
          </p>
          <p className="truncate font-bold text-red-600 dark:text-red-400">
            {formatPrice(totalPrice)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => go(step - 1)}
          disabled={step === 0}
          className="h-11 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 disabled:opacity-40"
        >
          Lùi
        </button>
        {step < lastStep && (
          <button
            type="button"
            onClick={() => go(step + 1)}
            className="h-11 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white"
          >
            {step === lastStep - 1 ? 'Tổng kết' : product ? 'Tiếp' : 'Bỏ qua'}
          </button>
        )}
      </div>
    </div>
  )
}

function SlotTitle({ slot, build }) {
  const needVga = slot.slug === 'vga' && build.cpu?.specs?.igpu === false
  return (
    <>
      {slot.label}
      {slot.optional && (
        <span
          className={`ml-1 text-xs font-normal ${needVga ? 'text-red-600 dark:text-red-400' : 'text-slate-500'}`}
        >
          ({needVga ? 'bắt buộc vì CPU không có iGPU' : 'không bắt buộc'})
        </span>
      )}
    </>
  )
}

function BuilderIntro() {
  return (
    <div>
      <h1 className="text-xl font-bold sm:text-2xl">Build PC</h1>
      <p className="mt-1 text-sm text-slate-500">
        Chọn từng linh kiện, web tự kiểm tra socket, chuẩn RAM, kích thước và công suất nguồn.{' '}
        <Link
          to="/san-pham"
          className="text-blue-700 dark:text-blue-300 underline hover:no-underline"
        >
          Xem tất cả sản phẩm
        </Link>
      </p>
    </div>
  )
}

function BuilderSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="h-16 rounded-xl bg-slate-200" />
      ))}
    </div>
  )
}
