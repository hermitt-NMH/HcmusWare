// Tạo public/data/don-vi-hanh-chinh.json cho ô gợi ý địa chỉ (F17) từ bộ dữ liệu
// vietnamese-provinces-database (MIT, mã đơn vị theo Tổng cục Thống kê).
// Chỉ giữ mã và tên đầy đủ để file nhỏ; bỏ dấu và xếp hạng gợi ý làm ở frontend.
//
// Cách chạy (chỉ khi có nghị quyết mới về đơn vị hành chính):
//   1. Tải và giải nén bản JSON mới nhất (xem docs/g2-ba-tuan1.md, mục Đơn vị hành chính)
//   2. npm run build-dvhc -- <đường dẫn tới full_json_generated_data_vn_units.json> <phiên bản> <nghị quyết>
//      vd: npm run build-dvhc -- D:/tmp/json/full_json_generated_data_vn_units.json v5.2.0 388/NQ-UBTVQH16

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const OUT_DIR = 'public/data'
const OUT = `${OUT_DIR}/don-vi-hanh-chinh.json`

const [input, version, decree] = process.argv.slice(2)
if (!input || !version || !decree) {
  console.error('Thiếu tham số: <file full_json...> <phiên bản> <nghị quyết>')
  process.exit(1)
}

const provinces = JSON.parse(readFileSync(input, 'utf8'))

const data = {
  source: 'https://github.com/thanglequoc/vietnamese-provinces-database',
  license: 'MIT © 2021 Thang Le Quoc',
  version,
  decree,
  // Mỗi tỉnh: [mã, tên đầy đủ, [[mã xã, tên đầy đủ], ...]]
  provinces: provinces
    .map((p) => [
      p.Code,
      p.FullName,
      p.Wards.map((w) => [w.Code, w.FullName]).sort((a, b) => a[1].localeCompare(b[1], 'vi')),
    ])
    .sort((a, b) => a[1].localeCompare(b[1], 'vi')),
}

const wardCount = data.provinces.reduce((n, p) => n + p[2].length, 0)
mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(OUT, JSON.stringify(data))
console.log(`Đã ghi ${OUT}: ${data.provinces.length} tỉnh/thành, ${wardCount} xã/phường/đặc khu`)
