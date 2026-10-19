import { supabase } from './supabase'

// Gom các truy vấn Supabase hay dùng vào một chỗ để các trang gọi lại.

export async function getCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, slug')
    .order('sort_order')
  if (error) throw error
  return data
}

// Lấy một danh mục theo slug. Không có thì trả null (để trang hiện 404).
export async function getCategoryBySlug(slug) {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, slug')
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function getProducts({ categorySlug, limit } = {}) {
  let query = supabase
    .from('products')
    .select('id, name, brand, price, stock, image_url, specs, categories!inner(slug, name)')
    .order('created_at', { ascending: false })
    // Nhiều sản phẩm trùng created_at (nhập cùng lúc) nên thêm id làm khóa phụ
    // để thứ tự luôn cố định giữa các lần tải.
    .order('id', { ascending: false })

  if (categorySlug) query = query.eq('categories.slug', categorySlug)
  if (limit) query = query.limit(limit)

  const { data, error } = await query
  if (error) throw error
  return data
}

// Chi tiết một sản phẩm. id sai hoặc không tồn tại thì trả null (để trang hiện 404).
export async function getProductById(id) {
  // id trên URL không phải số (vd /san-pham/abc) thì khỏi gọi DB – Postgres sẽ báo lỗi kiểu dữ liệu.
  // id quá lớn (vượt kiểu bigint, vd /san-pham/99999999999999999999) cũng không tồn tại → 404.
  if (!/^\d+$/.test(String(id)) || !Number.isSafeInteger(Number(id))) return null
  const { data, error } = await supabase
    .from('products')
    .select(
      'id, name, brand, price, stock, image_url, datasheet_url, description, specs, categories(slug, name)',
    )
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

// Sản phẩm cùng danh mục (trừ chính nó) cho mục "Sản phẩm tương tự".
export async function getRelatedProducts({ categorySlug, excludeId, limit = 4 }) {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, brand, price, stock, image_url, specs, categories!inner(slug, name)')
    .eq('categories.slug', categorySlug)
    .neq('id', excludeId)
    .gt('stock', 0)
    .order('id', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}
