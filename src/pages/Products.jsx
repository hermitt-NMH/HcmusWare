import { useParams } from 'react-router-dom'
import ProductGrid from '../components/ProductGrid'
import { getProducts } from '../lib/api'
import { useAsync } from '../hooks/useAsync'

// Danh sách sản phẩm (tất cả hoặc theo danh mục).
// Tuần 3: Dev1 bổ sung bộ lọc giá/thông số, sắp xếp, tìm kiếm.
export default function Products() {
  const { slug } = useParams()
  const products = useAsync(() => getProducts({ categorySlug: slug }), [slug])
  const title = slug ? products.data?.[0]?.categories.name ?? 'Danh mục' : 'Tất cả sản phẩm'

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">{title}</h1>
      <ProductGrid {...products} products={products.data} />
    </div>
  )
}
