import { Link, useParams } from 'react-router-dom'
import ProductGrid from '../components/ProductGrid'
import NotFound from './NotFound'
import { getProductById, getRelatedProducts } from '../lib/api'
import { useAsync } from '../hooks/useAsync'
import { formatPrice } from '../lib/format'
import { categoryBg, categoryImage } from '../lib/images'
import { specRows } from '../lib/specs'

// Trang chi tiết: ảnh, giá, tồn kho, bảng thông số, nút tải datasheet, sản phẩm tương tự.
export default function ProductDetail() {
  const { id } = useParams()
  const product = useAsync(() => getProductById(id), [id])

  if (product.loading) return <DetailSkeleton />
  if (product.error) {
    return (
      <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
        Không tải được sản phẩm: {product.error.message}
      </p>
    )
  }
  if (!product.data) return <NotFound />

  return <DetailView product={product.data} />
}

function DetailView({ product }) {
  const {
    id,
    name,
    brand,
    price,
    stock,
    image_url,
    datasheet_url,
    description,
    specs,
    categories,
  } = product
  const slug = categories?.slug
  const fallback = categoryImage(slug)
  const outOfStock = stock <= 0
  const rows = specRows(slug, specs)

  return (
    <div className="space-y-8">
      {/* Đường dẫn: Trang chủ / Danh mục / Tên */}
      <nav aria-label="Đường dẫn" className="text-sm text-slate-500">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link to="/" className="hover:text-blue-700 hover:underline">
              Trang chủ
            </Link>
          </li>
          {categories && (
            <li className="before:mx-1 before:content-['/']">
              <Link to={`/danh-muc/${slug}`} className="hover:text-blue-700 hover:underline">
                {categories.name}
              </Link>
            </li>
          )}
          <li className="line-clamp-1 text-slate-700 before:mx-1 before:content-['/']">{name}</li>
        </ol>
      </nav>

      <div className="grid gap-6 md:grid-cols-2">
        <div
          className={`flex aspect-square items-center justify-center overflow-hidden rounded-2xl border border-slate-200 ${image_url ? 'bg-white' : `bg-gradient-to-br ${categoryBg(slug)}`}`}
        >
          <img
            src={image_url || fallback}
            alt={name}
            onError={(e) => {
              if (!e.currentTarget.src.endsWith(fallback)) e.currentTarget.src = fallback
            }}
            className={`h-full w-full object-contain ${image_url ? 'p-6' : 'p-16'}`}
          />
        </div>

        <div className="flex flex-col gap-4">
          <div>
            {brand && (
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                {brand}
              </p>
            )}
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{name}</h1>
          </div>

          <p className="text-3xl font-bold text-red-600">{formatPrice(price)}</p>

          <p className={`text-sm font-medium ${outOfStock ? 'text-slate-500' : 'text-green-700'}`}>
            {outOfStock ? 'Hết hàng' : `Còn hàng – ${stock} sản phẩm`}
          </p>

          {description && <p className="text-sm leading-relaxed text-slate-600">{description}</p>}

          <div className="flex flex-col gap-2 sm:flex-row">
            {/* Giỏ hàng làm ở Tuần 4 (Dev3) – tạm khóa nút */}
            <button
              type="button"
              disabled
              title="Giỏ hàng sẽ có ở Tuần 4"
              className="h-12 flex-1 rounded-lg bg-blue-600 px-5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {outOfStock ? 'Hết hàng' : 'Thêm vào giỏ (sắp có)'}
            </button>
            {datasheet_url ? (
              <a
                href={datasheet_url}
                target="_blank"
                rel="noopener noreferrer"
                download
                className="inline-flex h-12 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 font-medium text-slate-700 hover:bg-slate-50"
              >
                Tải datasheet
              </a>
            ) : (
              <span className="inline-flex h-12 items-center justify-center rounded-lg border border-dashed border-slate-300 px-5 text-sm text-slate-400">
                Chưa có datasheet
              </span>
            )}
          </div>
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Thông số kỹ thuật</h2>
        {rows.length ? (
          <table className="w-full overflow-hidden rounded-xl border border-slate-200 bg-white text-sm">
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.key}
                  className="border-t border-slate-100 first:border-t-0 even:bg-slate-50"
                >
                  <th scope="row" className="w-2/5 px-4 py-3 text-left font-medium text-slate-500">
                    {r.label}
                  </th>
                  <td className="px-4 py-3 text-slate-900">{r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-slate-500">Chưa có thông số cho sản phẩm này.</p>
        )}
      </section>

      {slug && <RelatedProducts categorySlug={slug} excludeId={id} />}
    </div>
  )
}

function RelatedProducts({ categorySlug, excludeId }) {
  const related = useAsync(
    () => getRelatedProducts({ categorySlug, excludeId }),
    [categorySlug, excludeId],
  )
  // Không có sản phẩm tương tự thì ẩn hẳn mục này.
  if (!related.loading && !related.error && !related.data?.length) return null
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">Sản phẩm tương tự</h2>
      <ProductGrid {...related} products={related.data} skeletonCount={4} />
    </section>
  )
}

function DetailSkeleton() {
  return (
    <div className="grid animate-pulse gap-6 md:grid-cols-2">
      <div className="aspect-square rounded-2xl bg-slate-200" />
      <div className="space-y-4">
        <div className="h-4 w-24 rounded bg-slate-200" />
        <div className="h-8 w-3/4 rounded bg-slate-200" />
        <div className="h-9 w-40 rounded bg-slate-200" />
        <div className="h-12 rounded bg-slate-200" />
      </div>
    </div>
  )
}
