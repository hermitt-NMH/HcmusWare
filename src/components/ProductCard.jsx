import { Link } from 'react-router-dom'
import { formatPrice } from '../lib/format'
import { categoryBg, categoryImage } from '../lib/images'

export default function ProductCard({ product }) {
  const { id, name, brand, price, stock, image_url, categories } = product
  const outOfStock = stock <= 0
  const fallback = categoryImage(categories?.slug)

  return (
    <Link
      to={`/san-pham/${id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div
        className={`relative flex aspect-square items-center justify-center overflow-hidden ${image_url ? 'bg-white' : `bg-gradient-to-br ${categoryBg(categories?.slug)}`}`}
      >
        <img
          src={image_url || fallback}
          alt={name}
          loading="lazy"
          onError={(e) => {
            // Ảnh sản phẩm hỏng thì quay về ảnh minh họa của danh mục
            if (!e.currentTarget.src.endsWith(fallback)) e.currentTarget.src = fallback
          }}
          className={`h-full w-full object-contain transition duration-300 group-hover:scale-105 ${image_url ? 'p-2' : 'p-6'} ${outOfStock ? 'opacity-50 grayscale' : ''}`}
        />
        {brand && (
          <span className="absolute left-2 top-2 rounded-md bg-slate-900/70 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
            {brand}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 border-t border-slate-100 p-3">
        <h3 className="line-clamp-2 text-sm font-medium text-slate-900 group-hover:text-blue-700">
          {name}
        </h3>
        <p className="mt-auto pt-2 font-semibold text-red-600">{formatPrice(price)}</p>
        <p className={`text-xs ${outOfStock ? 'text-slate-400' : 'text-green-600'}`}>
          {outOfStock ? 'Hết hàng' : `Còn ${stock} sản phẩm`}
        </p>
      </div>
    </Link>
  )
}
