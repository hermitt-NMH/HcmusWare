import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAsync } from '../hooks/useAsync'
import { getProducts } from '../lib/api'
import { formatPrice } from '../lib/format'
import { categoryImage, thumbUrl } from '../lib/images'
import {
  MAX_BUDGET,
  MIN_BUDGET,
  PURPOSES,
  suggestBuilds,
  toBuilderState,
} from '../features/builder/budget'
import {
  BUILDER_SLOTS,
  STORAGE_KEY,
  parseStoredBuild,
  sameBuild,
  serializeBuild,
} from '../features/builder/builder'

const MILLION = 1_000_000
const QUICK_BUDGETS = [10, 15, 20, 30, 50]

// Đọc ngân sách (VNĐ) và nhu cầu từ URL: /goi-y-cau-hinh?ngan-sach=20000000&nhu-cau=gaming
// để tải lại trang hoặc gửi link vẫn ra đúng gợi ý.
function readQuery(params) {
  const budget = Number(params.get('ngan-sach'))
  const purpose = params.get('nhu-cau')
  return {
    budget: Number.isFinite(budget) && budget > 0 ? budget : null,
    purpose: PURPOSES[purpose] ? purpose : 'gaming',
  }
}

// F10 – Gợi ý cấu hình theo ngân sách (Giai đoạn 2, Tuần 2).
// Nhập ngân sách + nhu cầu → 2–3 cấu hình hợp lệ (budget.js, kiểm tra bằng compatibility.js),
// so sánh cạnh nhau, bấm "Mở trong Build PC" để chỉnh tiếp.
export default function BudgetSuggest() {
  const [params, setParams] = useSearchParams()
  const query = readQuery(params)
  const products = useAsync(() => getProducts())

  const result = useMemo(() => {
    if (!products.data || query.budget == null) return null
    try {
      return suggestBuilds(products.data, query)
    } catch (err) {
      return { error: err.message }
    }
  }, [products.data, query.budget, query.purpose]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">Gợi ý cấu hình theo ngân sách</h1>
        <p className="mt-1 text-sm text-slate-500">
          Nhập số tiền và nhu cầu, web chọn sẵn 2–3 cấu hình lắp được với nhau (đã kiểm tra socket,
          RAM, kích thước, công suất nguồn) từ hàng đang bán.
        </p>
      </div>

      <BudgetForm
        key={`${query.budget}-${query.purpose}`}
        initial={query}
        onSubmit={(budget, purpose) =>
          setParams({ 'ngan-sach': String(budget), 'nhu-cau': purpose })
        }
      />

      {products.loading && query.budget != null && (
        <p className="py-8 text-center text-slate-500">Đang tải linh kiện…</p>
      )}
      {products.error && (
        <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
          Không tải được linh kiện: {products.error.message}
        </p>
      )}
      {result?.error && (
        <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {result.error}
        </p>
      )}
      {result?.builds && <Results result={result} budget={query.budget} />}
    </div>
  )
}

function BudgetForm({ initial, onSubmit }) {
  const [millions, setMillions] = useState(initial.budget ? String(initial.budget / MILLION) : '')
  const [purpose, setPurpose] = useState(initial.purpose)
  const [error, setError] = useState('')

  const submit = (e) => {
    e.preventDefault()
    const budget = Math.round(Number(millions.replace(',', '.')) * MILLION)
    if (!Number.isFinite(budget) || budget < MIN_BUDGET || budget > MAX_BUDGET) {
      setError(`Ngân sách từ ${MIN_BUDGET / MILLION} đến ${MAX_BUDGET / MILLION} triệu đồng.`)
      return
    }
    setError('')
    onSubmit(budget, purpose)
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="space-y-4 rounded-2xl border border-slate-200 bg-surface p-5"
    >
      <div>
        <label htmlFor="budget" className="mb-1 block text-sm font-medium text-slate-700">
          Ngân sách (triệu đồng)
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            id="budget"
            type="number"
            inputMode="decimal"
            min={MIN_BUDGET / MILLION}
            max={MAX_BUDGET / MILLION}
            step="0.5"
            value={millions}
            onChange={(e) => {
              setMillions(e.target.value)
              setError('')
            }}
            placeholder="20"
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={error ? 'budget-error' : undefined}
            className={`h-11 w-32 rounded-lg border bg-surface px-3 text-sm focus:border-blue-500 focus:outline-none ${error ? 'border-red-400' : 'border-slate-300'}`}
          />
          {QUICK_BUDGETS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMillions(String(m))
                setError('')
              }}
              className={`h-11 rounded-lg border px-3 text-sm ${
                millions === String(m)
                  ? 'border-blue-600 bg-blue-50 font-semibold text-blue-700 dark:text-blue-300'
                  : 'border-slate-300 hover:bg-slate-50'
              }`}
            >
              {m} tr
            </button>
          ))}
        </div>
        {error && (
          <span id="budget-error" className="mt-1 block text-sm text-red-600 dark:text-red-400">
            {error}
          </span>
        )}
      </div>

      <fieldset>
        <legend className="mb-1 text-sm font-medium text-slate-700">Nhu cầu chính</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {Object.entries(PURPOSES).map(([key, p]) => (
            <label
              key={key}
              className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm ${
                purpose === key ? 'border-blue-600 bg-blue-50' : 'border-slate-300'
              }`}
            >
              <input
                type="radio"
                name="purpose"
                value={key}
                checked={purpose === key}
                onChange={() => setPurpose(key)}
                className="h-4 w-4 accent-blue-600"
              />
              {p.label}
            </label>
          ))}
        </div>
      </fieldset>

      <button
        type="submit"
        className="h-11 w-full rounded-lg bg-blue-600 px-6 font-semibold text-white hover:bg-blue-700 sm:w-auto"
      >
        Gợi ý cấu hình
      </button>
    </form>
  )
}

function Results({ result, budget }) {
  const navigate = useNavigate()
  const { builds, minTotal } = result

  if (!builds.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-surface p-6 text-center text-sm">
        <p className="text-slate-700">
          Không tìm được cấu hình hợp lệ trong {formatPrice(budget)}.
        </p>
        {minTotal != null && (
          <p className="mt-1 text-slate-500">
            Với nhu cầu này, cấu hình rẻ nhất đang có giá {formatPrice(minTotal)}.
          </p>
        )}
      </div>
    )
  }

  const openInBuilder = (build) => {
    const next = toBuilderState(build)
    try {
      const current = parseStoredBuild(localStorage.getItem(STORAGE_KEY))
      const hasCurrent = Object.keys(current.ids).length > 0
      if (
        hasCurrent &&
        !sameBuild(current, next) &&
        !window.confirm('Thay cấu hình đang build dở trong Build PC bằng gợi ý này?')
      )
        return
      localStorage.setItem(STORAGE_KEY, serializeBuild(next.ids, next.ramQty))
    } catch {
      // Không ghi được localStorage (chế độ ẩn danh...) → vẫn mở Build PC, khách chọn lại.
    }
    navigate('/build-pc')
  }

  // Dòng có linh kiện khác nhau giữa các gợi ý được tô nền để dễ so sánh.
  const differs = (slug) => new Set(builds.map((b) => b.parts[slug]?.id ?? null)).size > 1

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{builds.length} cấu hình gợi ý</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {builds.map((b) => (
          <article
            key={b.tier}
            className="flex flex-col rounded-2xl border border-slate-200 bg-surface p-4"
          >
            <h3 className="font-semibold">{b.label}</h3>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
              {formatPrice(b.total)}
            </p>
            <p className="text-xs text-slate-500">
              {Math.round((b.total / budget) * 100)}% ngân sách
            </p>
            <ul className="my-3 flex-1 divide-y divide-slate-100 text-sm">
              {BUILDER_SLOTS.map(({ slug, label }) => {
                const part = b.parts[slug]
                return (
                  <li
                    key={slug}
                    className={`flex items-center gap-2 rounded px-1 py-2 ${differs(slug) ? 'bg-blue-50' : ''}`}
                  >
                    {part ? (
                      <img
                        src={thumbUrl(part.image_url) || categoryImage(slug)}
                        alt=""
                        loading="lazy"
                        className="h-10 w-10 shrink-0 rounded border border-slate-100 bg-white object-contain"
                      />
                    ) : (
                      <span className="h-10 w-10 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-slate-500">{label}</p>
                      {part ? (
                        <Link
                          to={`/san-pham/${part.id}`}
                          className="line-clamp-2 hover:text-blue-700 hover:underline dark:hover:text-blue-300"
                        >
                          {part.name}
                        </Link>
                      ) : (
                        <p className="text-slate-500">Dùng đồ họa tích hợp của CPU</p>
                      )}
                    </div>
                    {part && (
                      <span className="shrink-0 text-xs font-medium">
                        {formatPrice(part.price)}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
            {b.warnings.length > 0 && (
              <ul className="mb-3 space-y-1 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
                {b.warnings.map((w) => (
                  <li key={w.rule}>⚠ {w.message}</li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() => openInBuilder(b)}
              className="h-11 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Mở trong Build PC
            </button>
          </article>
        ))}
      </div>
      <p className="text-xs text-slate-500">
        Gợi ý tự động từ hàng còn trong kho; xếp hạng sức mạnh CPU/VGA là ước lượng tương đối. Mở
        trong Build PC để đổi từng linh kiện.
      </p>
    </section>
  )
}
