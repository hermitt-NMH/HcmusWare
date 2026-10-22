// Sinh lịch sử giá giả lập 6 tháng cho mọi sản phẩm và ghi vào bảng price_history.
//
// Cách chạy:
//   1. Điền VITE_SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY trong .env.local (giống import-data)
//   2. npm run gen-price-history              (thêm -- --dry-run để chỉ xem, không ghi DB)
//
// Mỗi sản phẩm: XÓA lịch sử cũ rồi ghi lại chuỗi giá mới, mỗi tuần một điểm, chỉ lưu
// các lần đổi giá; điểm cuối là giá hiện tại ở thời điểm chạy script.
// Seed ngẫu nhiên = id sản phẩm → chạy lại cho ra cùng hình dạng (chỉ dịch theo ngày chạy).
// Thuật toán nằm trong src/features/price/price.js (có unit test).

import { createClient } from '@supabase/supabase-js'
import { compactSeries, generatePriceSeries } from '../src/features/price/price.js'

const DRY_RUN = process.argv.includes('--dry-run')
const MONTHS = 6

async function main() {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key)
    throw new Error('Thiếu VITE_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong .env.local')

  const supabase = createClient(url, key, { auth: { persistSession: false } })
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, price')
    .order('id')
  if (error) throw error
  if (!products.length) throw new Error('Chưa có sản phẩm – hãy chạy npm run import-data trước.')

  const now = new Date()
  const rows = products.flatMap((p) =>
    compactSeries(generatePriceSeries(p.price, { months: MONTHS, seed: p.id, now })).map((pt) => ({
      product_id: p.id,
      ...pt,
    })),
  )
  console.log(`${products.length} sản phẩm → ${rows.length} điểm giá (${MONTHS} tháng).`)

  const sample = products[0]
  console.log(`\nVí dụ "${sample.name}":`)
  for (const r of rows.filter((r) => r.product_id === sample.id)) {
    console.log(`  ${r.recorded_at.slice(0, 10)}  ${r.price.toLocaleString('vi-VN')} ₫`)
  }

  if (DRY_RUN) return console.log('\n--dry-run: không ghi vào Supabase.')

  const ids = products.map((p) => p.id)
  const { error: delError } = await supabase.from('price_history').delete().in('product_id', ids)
  if (delError) throw delError

  // Ghi từng đợt 500 dòng cho nhẹ request.
  for (let i = 0; i < rows.length; i += 500) {
    const { error: insError } = await supabase.from('price_history').insert(rows.slice(i, i + 500))
    if (insError) throw insError
  }
  console.log('\nĐã ghi lịch sử giá lên Supabase.')
}

main().catch((err) => {
  console.error('Lỗi:', err.message)
  process.exit(1)
})
