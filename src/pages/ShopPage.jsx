import { useParams } from 'react-router-dom'
import { useAsync } from '../hooks/useAsync'
import { getProducts, getShopBySlug } from '../lib/api'
import ProductBrowser from '../components/ProductBrowser'
import ProductGrid from '../components/ProductGrid'
import LogoBadge from '../components/LogoBadge'
import NotFound from './NotFound'

// /shop/:slug (US-15.3): thông tin shop + sản phẩm đang bán.
// Chỉ shop đang hoạt động mới xem được; shop chờ duyệt / bị khóa → 404 (không lộ là shop tồn tại).
export default function ShopPage() {
  const { slug } = useParams()
  const shop = useAsync(() => getShopBySlug(slug), [slug])
  const shopId = shop.data?.id
  const products = useAsync(
    () => (shopId ? getProducts({ shopId }) : Promise.resolve([])),
    [shopId ?? 0],
  )

  if (shop.loading)
    return (
      <div>
        <div className="mb-4 h-24 animate-pulse rounded-xl bg-slate-200" />
        <ProductGrid loading />
      </div>
    )
  if (shop.error)
    return (
      <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
        Không tải được shop: {shop.error.message}
      </p>
    )
  if (!shop.data) return <NotFound />

  const s = shop.data
  const joined = new Date(s.created_at).toLocaleDateString('vi-VN', {
    month: '2-digit',
    year: 'numeric',
  })
  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-surface p-5 sm:flex-row">
        <LogoBadge name={s.name} url={s.logo_url} size="h-20 w-20" text="text-3xl" />
        <div className="min-w-0 flex-1 space-y-2">
          <h1 className="text-xl font-bold sm:text-2xl">{s.name}</h1>
          <dl className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600">
            <div>
              <dt className="sr-only">Đánh giá</dt>
              {/* Điểm đánh giá trung bình có ở F16 (Tuần 4) */}
              <dd>Chưa có đánh giá</dd>
            </div>
            <div className="flex gap-1">
              <dt>Sản phẩm:</dt>
              <dd className="font-medium text-slate-800">{products.data?.length ?? '…'}</dd>
            </div>
            <div className="flex gap-1">
              <dt>Tham gia từ tháng</dt>
              <dd className="font-medium text-slate-800">{joined}</dd>
            </div>
          </dl>
          {s.description && (
            <p className="whitespace-pre-line text-sm text-slate-600">{s.description}</p>
          )}
        </div>
      </section>
      <ProductBrowser products={products} searchLabel={s.name} />
    </div>
  )
}
