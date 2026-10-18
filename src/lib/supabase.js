import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anonKey)

if (!isSupabaseConfigured) {
  console.warn('Thiếu VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY. Hãy tạo file .env.local từ .env.example.')
}

// Dùng URL giả khi chưa cấu hình để app vẫn render được (các truy vấn sẽ báo lỗi).
export const supabase = createClient(url || 'http://localhost:54321', anonKey || 'missing-key')
