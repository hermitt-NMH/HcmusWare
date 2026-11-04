import { Link } from 'react-router-dom'
import { t } from '../lib/i18n'

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-surface">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 text-sm text-slate-600 sm:grid-cols-3">
        <div>
          <p className="font-semibold text-slate-900">HcmusWare</p>
          <p className="mt-2">
            {t('Linh kiện máy tính chính hãng, build PC tự kiểm tra tương thích.')}
          </p>
        </div>
        <div>
          <p className="font-semibold text-slate-900">{t('Hỗ trợ')}</p>
          <ul className="mt-2 space-y-1">
            <li>Email: hoangbensan@gmail.com</li>
            <li>
              <Link to="/chinh-sach-bao-mat" className="hover:underline">
                {t('Chính sách bảo mật')}
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="font-semibold text-slate-900">{t('Đồ án')}</p>
          <p className="mt-2">{t('Yêu Khoa học, chọn Tự nhiên – Nhập môn CNTT, 2026.')}</p>
        </div>
      </div>
    </footer>
  )
}
