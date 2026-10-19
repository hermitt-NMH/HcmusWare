import ProductCard from './ProductCard'

// Lưới sản phẩm dùng chung, xử lý luôn trạng thái đang tải / lỗi / rỗng.
// skeletonCount: số ô xám khi đang tải (nên bằng số sản phẩm sẽ hiện để trang không bị giật).
export default function ProductGrid({ products, loading, error, skeletonCount = 8 }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: skeletonCount }, (_, i) => (
          <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-slate-200" />
        ))}
      </div>
    )
  }
  if (error) {
    return (
      <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
        Không tải được sản phẩm: {error.message}
      </p>
    )
  }
  if (!products?.length) {
    return <p className="p-4 text-sm text-slate-500">Chưa có sản phẩm nào.</p>
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  )
}
