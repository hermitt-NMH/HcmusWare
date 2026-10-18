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

export async function getProducts({ categorySlug, limit } = {}) {
  let query = supabase
    .from('products')
    .select('id, name, brand, price, stock, image_url, specs, categories!inner(slug, name)')
    .order('created_at', { ascending: false })

  if (categorySlug) query = query.eq('categories.slug', categorySlug)
  if (limit) query = query.limit(limit)

  const { data, error } = await query
  if (error) throw error
  return data
}
