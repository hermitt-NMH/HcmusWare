import { Link } from 'react-router-dom'
import { formatPrice } from '../lib/format'

export default function ProductCard({ product }) {
  const { id, name, brand, price, stock, image_url } = product
  const outOfStock = stock <= 0

  return (
    <Link
      to={`/san-pham/${id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:shadow-md"
    >
      <div className="flex aspect-square items-center justify-center bg-slate-100">
        {image_url ? (
          <img src={image_url} alt={name} loading="lazy" className="h-full w-full object-contain p-4" />
        ) : (
          <img src="/logo.svg" alt="" className="h-12 w-12 opacity-30" />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        {brand && <p className="text-xs uppercase tracking-wide text-slate-500">{brand}</p>}
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
