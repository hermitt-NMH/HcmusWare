import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 text-sm text-slate-600 sm:grid-cols-3">
        <div>
          <p className="font-semibold text-slate-900">HcmusWare</p>
          <p className="mt-2">Linh kiện máy tính chính hãng, build PC tự kiểm tra tương thích.</p>
        </div>
        <div>
          <p className="font-semibold text-slate-900">Hỗ trợ</p>
          <ul className="mt-2 space-y-1">
            <li>Email: hoangbensan@gmail.com</li>
            <li>
              <Link to="/chinh-sach-bao-mat" className="hover:underline">
                Chính sách bảo mật
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="font-semibold text-slate-900">Đồ án</p>
          <p className="mt-2">Yêu Khoa học, chọn Tự nhiên – Nhập môn CNTT, 2026.</p>
        </div>
      </div>
    </footer>
  )
}
