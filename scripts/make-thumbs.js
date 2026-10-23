// Tạo ảnh thu nhỏ 400px (<tên>-sm.webp) cho mọi ảnh trong public/images/products/.
// Thẻ sản phẩm trên điện thoại chỉ rộng ~185px (~320px thật ở màn hình DPR 1.75) nên tải
// ảnh 600px là phí (Lighthouse báo "Properly size images"). lib/images.js tự đổi đường dẫn
// sang bản -sm.
//
// Cách chạy: npm run thumbs   (chỉ tạo lại ảnh thu nhỏ cũ hơn ảnh gốc)

import { readdir, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const DIR = new URL('../public/images/products/', import.meta.url)
const THUMB = 400

const files = (await readdir(DIR)).filter((f) => f.endsWith('.webp') && !f.endsWith('-sm.webp'))
let made = 0
for (const file of files) {
  const src = new URL(file, DIR)
  const out = new URL(file.replace(/\.webp$/, '-sm.webp'), DIR)
  const fresh = await stat(out).then(
    async (o) => o.mtimeMs >= (await stat(src)).mtimeMs,
    () => false,
  )
  if (fresh) continue
  await sharp(fileURLToPath(src))
    .resize(THUMB, THUMB, { fit: 'inside' })
    .webp({ quality: 78 })
    .toFile(fileURLToPath(out))
  made++
}
console.log(`Ảnh gốc: ${files.length}, tạo mới ảnh thu nhỏ: ${made}`)
