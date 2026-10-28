import { Link } from 'react-router-dom'
import { useAsync } from '../hooks/useAsync'
import { getBrandList } from '../lib/api'
import LogoBadge from '../components/LogoBadge'

// /thuong-hieu (US-15.1): lưới thương hiệu A–Z, kèm số sản phẩm đang bán.
// Thương hiệu chưa có sản phẩm đang bán vẫn hiện nhưng mờ, đứng cuối.
export default function BrandList() {
  const brands = useAsync(getBrandList)

  const list = [...(brands.data ?? [])].sort(
    (a, b) =>
      (Number(b.product_count) > 0) - (Number(a.product_count) > 0) ||
      a.name.localeCompare(b.name, 'vi'),
  )

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold sm:text-2xl">Thương hiệu</h1>
      {brands.loading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-slate-200" />
          ))}
        </div>
      )}
      {brands.error && (
        <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
          Không tải được thương hiệu: {brands.error.message}
        </p>
      )}
      {brands.data && !list.length && (
        <p className="p-4 text-sm text-slate-500">Chưa có thương hiệu nào.</p>
      )}
      {list.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {list.map((b) => {
            const count = Number(b.product_count)
            return (
              <li key={b.id}>
                <Link
                  to={`/thuong-hieu/${b.slug}`}
                  className={`flex h-full flex-col items-center gap-2 rounded-xl border border-slate-200 bg-surface p-4 text-center transition hover:-translate-y-0.5 hover:shadow-md ${count ? '' : 'opacity-60'}`}
                >
                  <LogoBadge name={b.name} url={b.logo_url} size="h-16 w-16" text="text-2xl" />
                  <span className="line-clamp-2 text-sm font-semibold">{b.name}</span>
                  <span className="text-xs text-slate-500">
                    {count ? `${count} sản phẩm` : 'Chưa có sản phẩm'}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
