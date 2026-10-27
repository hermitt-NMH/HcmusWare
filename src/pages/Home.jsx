import { Link } from 'react-router-dom'
import ProductGrid from '../components/ProductGrid'
import { getCategories, getProducts } from '../lib/api'
import { useAsync } from '../hooks/useAsync'
import { categoryBg, categoryImage } from '../lib/images'

export default function Home() {
  const categories = useAsync(getCategories)
  const products = useAsync(() => getProducts({ limit: 8 }))

  return (
    <div className="space-y-8">
      <section className="rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 px-6 py-10 text-white sm:px-10">
        <h1 className="text-2xl font-bold sm:text-3xl">Tự build PC, không lo lắp sai</h1>
        <p className="mt-2 max-w-xl text-blue-100">
          Chọn đủ 8 linh kiện, hệ thống tự kiểm tra socket, chuẩn RAM, kích thước và công suất
          nguồn.
        </p>
        <Link
          to="/build-pc"
          className="mt-5 inline-block rounded-lg bg-white px-5 py-2.5 font-semibold text-blue-700 hover:bg-blue-100"
        >
          Bắt đầu build
        </Link>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Danh mục</h2>
        {/* 3 trạng thái giống ProductGrid: đang tải (8 ô xám), lỗi, có dữ liệu */}
        {categories.loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="h-36 animate-pulse rounded-xl bg-slate-200" />
            ))}
          </div>
        ) : categories.error ? (
          <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
            Không tải được danh mục: {categories.error.message}
          </p>
        ) : !categories.data?.length ? (
          <p className="p-4 text-sm text-slate-500">Chưa có danh mục nào.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {categories.data.map((c) => (
              <Link
                key={c.id}
                to={`/danh-muc/${c.slug}`}
                className="group flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-surface p-4 text-center text-sm font-medium hover:border-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
              >
                <span
                  className={`flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br ${categoryBg(c.slug)}`}
                >
                  <img
                    src={categoryImage(c.slug)}
                    alt=""
                    className="h-14 w-14 transition duration-300 group-hover:scale-110"
                  />
                </span>
                {c.name}
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Sản phẩm mới</h2>
          <Link
            to="/san-pham"
            className="inline-flex min-h-11 items-center text-sm text-blue-700 dark:text-blue-300 hover:underline"
          >
            Xem tất cả
          </Link>
        </div>
        <ProductGrid {...products} products={products.data} />
      </section>
    </div>
  )
}
