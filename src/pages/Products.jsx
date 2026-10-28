import { useParams } from 'react-router-dom'
import ProductGrid from '../components/ProductGrid'
import ProductBrowser from '../components/ProductBrowser'
import NotFound from './NotFound'
import { getCategoryBySlug, getProducts } from '../lib/api'
import { useAsync } from '../hooks/useAsync'

// Danh sách sản phẩm (tất cả hoặc theo danh mục) có tìm kiếm, bộ lọc, sắp xếp (ProductBrowser).
// Toàn bộ bộ lọc nằm trên URL, vd: /danh-muc/cpu?q=ryzen&s_socket=AM5&sort=price-asc
export default function Products() {
  const { slug } = useParams()

  // Trang "Tất cả sản phẩm" không có slug thì không cần tải danh mục.
  const category = useAsync(() => (slug ? getCategoryBySlug(slug) : Promise.resolve(null)), [slug])
  const products = useAsync(() => getProducts({ categorySlug: slug }), [slug])

  if (slug) {
    if (category.loading) {
      return (
        <div>
          <div className="mb-4 h-7 w-40 animate-pulse rounded bg-slate-200" />
          <ProductGrid loading />
        </div>
      )
    }
    if (category.error) {
      return (
        <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
          Không tải được danh mục: {category.error.message}
        </p>
      )
    }
    // Slug không khớp danh mục nào → 404 thay vì trang rỗng.
    if (!category.data) return <NotFound />
  }

  const title = slug ? category.data.name : 'Tất cả sản phẩm'
  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">{title}</h1>
      <ProductBrowser products={products} categorySlug={slug} searchLabel={slug ? title : null} />
    </div>
  )
}
