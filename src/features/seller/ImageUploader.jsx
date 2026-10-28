import { useRef, useState } from 'react'
import { uploadShopImage } from '../../lib/api'
import { checkImageFile } from './sellerProduct'

// Chọn ảnh → kiểm tra (JPG/PNG/WebP, ≤ 2 MB) → tải ngay lên Storage (thư mục của shop) → trả link.
// images: mảng link đang có; ảnh đầu tiên là ảnh đại diện. max: số ảnh tối đa.
// Lưu ý: ảnh đã tải mà người bán bấm Hủy thì vẫn nằm trên Storage (chấp nhận, ảnh nhỏ ≤ 2 MB).
export default function ImageUploader({ shopId, images, onChange, max = 5, label, error, id }) {
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [problems, setProblems] = useState([])

  const pick = async (e) => {
    const files = [...e.target.files]
    e.target.value = '' // chọn lại đúng file đó vẫn chạy onChange
    const room = max - images.length
    const found = []
    if (files.length > room) found.push(`Chỉ thêm được ${room} ảnh nữa (tối đa ${max}).`)
    const valid = []
    for (const file of files.slice(0, room)) {
      const problem = checkImageFile(file)
      if (problem) found.push(problem)
      else valid.push(file)
    }
    setProblems(found)
    if (!valid.length) return

    setUploading(true)
    const added = []
    for (const file of valid) {
      try {
        added.push(await uploadShopImage(shopId, file))
      } catch (err) {
        found.push(`Không tải được "${file.name}": ${err.message}`)
      }
    }
    setUploading(false)
    setProblems([...found])
    if (added.length) onChange([...images, ...added])
  }

  const remove = (url) => onChange(images.filter((u) => u !== url))
  const makeFirst = (url) => onChange([url, ...images.filter((u) => u !== url)])

  return (
    <div>
      {label && <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>}
      <div className="flex flex-wrap gap-2">
        {images.map((url, i) => (
          <figure
            key={url}
            className="relative h-24 w-24 overflow-hidden rounded-lg border border-slate-200 bg-white"
          >
            <img src={url} alt={`Ảnh ${i + 1}`} className="h-full w-full object-contain" />
            {i === 0 && max > 1 && (
              <figcaption className="absolute inset-x-0 bottom-0 bg-gray-900/70 text-center text-[11px] text-white">
                Ảnh đại diện
              </figcaption>
            )}
            <button
              type="button"
              onClick={() => remove(url)}
              aria-label={`Bỏ ảnh ${i + 1}`}
              className="absolute right-0 top-0 inline-flex h-8 w-8 items-center justify-center rounded-bl-lg bg-gray-900/70 text-white hover:bg-red-700"
            >
              ✕
            </button>
            {i > 0 && (
              <button
                type="button"
                onClick={() => makeFirst(url)}
                className="absolute inset-x-0 bottom-0 bg-gray-900/70 py-0.5 text-[11px] text-white hover:bg-blue-700"
              >
                Đặt làm đại diện
              </button>
            )}
          </figure>
        ))}
        {images.length < max && (
          <button
            id={id}
            type="button"
            onClick={() => inputRef.current.click()}
            disabled={uploading || !shopId}
            aria-invalid={error ? 'true' : undefined}
            className={`flex h-24 w-24 flex-col items-center justify-center rounded-lg border-2 border-dashed text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-60 ${error ? 'border-red-400' : 'border-slate-300'}`}
          >
            <span className="text-2xl leading-none">+</span>
            {uploading ? 'Đang tải…' : 'Thêm ảnh'}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple={max > 1}
        onChange={pick}
        className="hidden"
      />
      <span className="mt-1 block text-xs text-slate-500">
        JPG, PNG hoặc WebP, mỗi ảnh tối đa 2 MB{max > 1 ? `, tối đa ${max} ảnh` : ''}.
      </span>
      {[error, ...problems].filter(Boolean).map((p) => (
        <span key={p} role="alert" className="mt-1 block text-sm text-red-600 dark:text-red-400">
          {p}
        </span>
      ))}
    </div>
  )
}
