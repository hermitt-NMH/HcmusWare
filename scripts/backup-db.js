// Sao lưu dữ liệu mọi bảng public ra một file JSON trong backups/ (không commit).
// Dùng trước mỗi lần chạy test ghi dữ liệu lên Supabase online (test:e2e:online).
//
// Cách chạy:
//   npm run db:backup          – DB online (đọc .env.online.local)
//   npm run db:backup:local    – DB local  (đọc .env.local)
// Cần VITE_SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY. Schema không cần sao lưu vì đã nằm
// trong supabase/migrations. Không cần Docker (khác với `npx supabase db dump`).

import { createClient } from '@supabase/supabase-js'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// Theo thứ tự khóa ngoại, để khi khôi phục chèn lại từ trên xuống
const TABLES = [
  'categories',
  'brands',
  'shops',
  'products',
  'price_history',
  'profiles',
  'orders',
  'order_items',
  'saved_builds',
  'price_alerts',
  'reviews',
  'addresses',
  'comments',
  'notifications',
]
const PAGE = 1000

async function main() {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Thiếu VITE_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY')

  const supabase = createClient(url, key, { auth: { persistSession: false } })
  const backup = { url, createdAt: new Date().toISOString(), tables: {} }

  for (const table of TABLES) {
    const rows = []
    let missing = false
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .order('id')
        .range(from, from + PAGE - 1)
      // Bảng của migration chưa đẩy lên (vd addresses trước khi db push) → bỏ qua, vẫn sao lưu phần còn lại.
      if (error?.code === 'PGRST205') {
        missing = true
        break
      }
      if (error) throw new Error(`Đọc bảng ${table} lỗi: ${error.message}`)
      rows.push(...data)
      if (data.length < PAGE) break
    }
    if (missing) {
      console.log(`${table.padEnd(14)} chưa có trên DB này, bỏ qua`)
      continue
    }
    backup.tables[table] = rows
    console.log(`${table.padEnd(14)} ${rows.length} dòng`)
  }

  const dir = join(import.meta.dirname, '..', 'backups')
  mkdirSync(dir, { recursive: true })
  const stamp = backup.createdAt.slice(0, 16).replace(/[-:]/g, '').replace('T', '-')
  const file = join(dir, `${new URL(url).hostname.split('.')[0]}-${stamp}.json`)
  writeFileSync(file, JSON.stringify(backup, null, 1))
  console.log(`\nĐã lưu ${file}`)
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
