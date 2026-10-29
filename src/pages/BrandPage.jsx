import { Link, useParams } from 'react-router-dom'
import { useAsync } from '../hooks/useAsync'
import { getBrandBySlug, getProducts } from '../lib/api'
import ProductBrowser from '../components/ProductBrowser'
import ProductGrid from '../components/ProductGrid'
import LogoBadge from '../components/LogoBadge'
import NotFound from './NotFound'

// /thuong-hieu/:slug (US-15.2): sản phẩm đang bán của một thương hiệu (mọi shop),
// lọc theo danh mục, giá, shop giống trang danh mục. Slug không tồn tại → 404.
export default function BrandPage() {
  const { slug } = useParams()
  const brand = useAsync(() => getBrandBySlug(slug), [slug])
  const brandId = brand.data?.id
  const products = useAsync(
    () => (brandId ? getProducts({ brandId }) : Promise.resolve([])),
    [brandId ?? 0],
  )

  if (brand.loading)
    return (
      <div>
        <div className="mb-4 h-16 w-60 animate-pulse rounded-xl bg-slate-200" />
        <ProductGrid loading />
      </div>
    )
  if (brand.error)
    return (
      <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
        Không tải được thương hiệu: {brand.error.message}
      </p>
    )
  if (!brand.data) return <NotFound />

  return (
    <div className="space-y-4">
      <nav aria-label="Đường dẫn" className="text-sm text-slate-500">
        <Link
          to="/thuong-hieu"
          className="inline-flex min-h-11 items-center hover:text-blue-700 hover:underline dark:hover:text-blue-300"
        >
          ← Tất cả thương hiệu
        </Link>
      </nav>
      <div className="flex items-center gap-4">
        <LogoBadge
          name={brand.data.name}
          url={brand.data.logo_url}
          size="h-16 w-32"
          text="text-2xl"
        />
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">{brand.data.name}</h1>
          {products.data && (
            <p className="text-sm text-slate-500">{products.data.length} sản phẩm đang bán</p>
          )}
        </div>
      </div>
      <ProductBrowser products={products} searchLabel={brand.data.name} />
    </div>
  )
}
