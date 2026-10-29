import { Link } from 'react-router-dom'
import { formatPrice } from '../lib/format'
import { categoryBg, categoryImage, productSrcSet } from '../lib/images'
import { formatRating } from '../features/reviews/reviews'

// eager: thẻ ở hàng đầu (thấy ngay khi mở trang) tải ảnh luôn, không lazy, để LCP nhanh hơn.
export default function ProductCard({ product, eager = false }) {
  const { id, name, brand, price, stock, image_url, categories, shops, product_ratings } = product
  const rating = formatRating(product_ratings?.rating_avg, product_ratings?.rating_count)
  const outOfStock = stock <= 0
  const fallback = categoryImage(categories?.slug)

  return (
    <Link
      to={`/san-pham/${id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-surface transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div
        className={`relative flex aspect-square items-center justify-center overflow-hidden ${image_url ? 'bg-white' : `bg-gradient-to-br ${categoryBg(categories?.slug)}`}`}
      >
        <img
          src={image_url || fallback}
          srcSet={productSrcSet(image_url)}
          sizes="(min-width: 1024px) 270px, (min-width: 640px) calc((100vw - 56px) / 3), calc((100vw - 44px) / 2)"
          width="600"
          height="600"
          alt={name}
          loading={eager ? 'eager' : 'lazy'}
          fetchPriority={eager ? 'high' : 'auto'}
          onError={(e) => {
            // Ảnh sản phẩm hỏng thì quay về ảnh minh họa của danh mục
            if (!e.currentTarget.src.endsWith(fallback)) {
              e.currentTarget.removeAttribute('srcset')
              e.currentTarget.src = fallback
            }
          }}
          className={`h-full w-full object-contain transition duration-300 group-hover:scale-105 ${image_url ? 'p-2' : 'p-6'} ${outOfStock ? 'opacity-50 grayscale' : ''}`}
        />
        {brand && (
          <span className="absolute left-2 top-2 rounded-md bg-gray-900/70 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
            {brand}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 border-t border-slate-100 p-3">
        <h3 className="line-clamp-2 text-sm font-medium text-slate-900 group-hover:text-blue-700 dark:group-hover:text-blue-300">
          {name}
        </h3>
        {/* Shop bán (F15); shop chính HcmusWare thì không cần ghi */}
        {shops?.slug && shops.slug !== 'hcmusware' && (
          <p className="line-clamp-1 text-xs text-slate-500">{shops.name}</p>
        )}
        {/* Điểm trung bình (F16); chưa có lượt nào thì không ghi gì cho gọn */}
        {rating && (
          <p className="text-xs text-slate-600">
            <span className="text-amber-600" aria-hidden="true">
              ★
            </span>{' '}
            {rating.replace(' ★', '')}
          </p>
        )}
        <p className="mt-auto pt-2 font-semibold text-red-600 dark:text-red-400">
          {formatPrice(price)}
        </p>
        <p
          className={`text-xs ${outOfStock ? 'text-slate-500' : 'text-green-700 dark:text-green-400'}`}
        >
          {outOfStock ? 'Hết hàng' : `Còn ${stock} sản phẩm`}
        </p>
      </div>
    </Link>
  )
}
