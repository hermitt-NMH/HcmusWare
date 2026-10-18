export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 text-sm text-slate-600 sm:grid-cols-3">
        <div>
          <p className="font-semibold text-slate-900">PC Parts</p>
          <p className="mt-2">Linh kiện máy tính chính hãng, build PC tự kiểm tra tương thích.</p>
        </div>
        <div>
          <p className="font-semibold text-slate-900">Hỗ trợ</p>
          <ul className="mt-2 space-y-1">
            <li>Hotline: 1900 0000</li>
            <li>Email: hotro@pcparts.local</li>
          </ul>
        </div>
        <div>
          <p className="font-semibold text-slate-900">Đồ án</p>
          <p className="mt-2">Nhóm 8 – Nhập môn CNTT, 2026.</p>
        </div>
      </div>
    </footer>
  )
}
